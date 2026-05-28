/**
 * `useReviewingFetch` — owns the two long-running effects that
 * gate the reviewing surface:
 *
 *   - **Status polling** (q_and_a → reviewing flip). While the user
 *     sits in q_and_a waiting for the admin to publish their
 *     session, this polls `/api/results/<sid>/status` every 5s.
 *     When status returns `"completed"` we flip `phase=reviewing`,
 *     which mounts the second effect.
 *
 *   - **Reviewing fetch + 30s refresh** (snippet load + incremental
 *     append). On reviewing entry: fetch snippets, append dashboard
 *     + contrast bubbles once, queue snippets for serial reveal,
 *     auto-reveal the first one if no `action_pending` is in flight.
 *     Then re-fetch every 30s, diffing against `seenSnippetIdsRef`,
 *     and only append snippets whose id is new + not already closed
 *     out (spec C5 idempotency).
 *
 * Pure side-effect hook — no return value. All visible state is
 * owned by upstream hooks (`useChatPhase` for `phase`, the parent
 * for `actionBubbleInfoRef` + `closedOutSnippetIdsRef`).
 *
 * Refetch trigger: both effects list `refetchToken` in their deps
 * so a `usePublishLiveSubscription` event (Realtime publish or 20s
 * fallback poll) bumps the token, the effects re-bind, and the
 * first probe/load runs immediately — no 5s/30s wait.
 */
import { useCallback, useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { ThreadHandle } from "@/components/chat/thread/useThread";
import type { Bubble, Phase } from "@/components/chat/thread/types";
import type {
  AcousticMetricsBubbleData,
  SnippetPlayerData,
} from "@/components/chat/RichBubbles";
import { botBubblesFromText } from "@/lib/chat/botBubbles";
import { parseStressContrast } from "@/lib/chat/stressContrast";
import {
  fetchUserSessionSummary,
  type UserSessionSummaryMetrics,
} from "@/services/api/userSessionSummary";

const POLL_INTERVAL_MS = 5_000;
/**
 * Re-fetch the reviewing-phase snippets endpoint every 30s so admin
 * re-publishes land on an already-open chat without the user logging
 * out. Idempotent — only NEW snippet ids (vs `seenSnippetIdsRef`)
 * get appended. See the reviewing effect for the full diff logic.
 */
const REVIEW_REFRESH_MS = 30_000;

/**
 * Map the BE task-8 summary metrics shape into the FE-side
 * AcousticMetricsBubble data. Field names diverge (snake_case
 * vs camelCase, pitch as Hz number vs labelled string), so the
 * mapping isn't 1:1 — `flow` has no direct backend field and
 * stays null until BE exposes one.
 */
function mapSummaryMetricsToBubble(
  m: UserSessionSummaryMetrics
): AcousticMetricsBubbleData {
  return {
    wpm: m.wpm,
    pitch: m.pitch_center_hz != null ? `${Math.round(m.pitch_center_hz)} Hz` : null,
    flow: null,
    fillers: m.fillers,
    dynamicDb: m.dynamic_db,
    energy: m.energy,
  };
}

/**
 * Map a backend snippet row into the SnippetPlayerData the rich
 * bubble component renders. Inlined from the retired ChatReview;
 * the reviewing-phase fetch effect calls this on every row.
 */
function mapBackendSnippet(s: {
  id: string;
  snippet_type: "charisma" | "stress" | "unlabeled" | null;
  admin_comment: string;
  audio_url: string | null;
  start_offset_ms: number;
  duration_ms: number;
}): SnippetPlayerData {
  const type: "charisma" | "stress" =
    s.snippet_type === "stress" ? "stress" : "charisma";
  return {
    id: s.id,
    type,
    badgeLabel:
      type === "charisma" ? "Charisma Highlight" : "Stress Indicator",
    insight: (s.admin_comment ?? "").trim(),
    audioUrl: s.audio_url,
    startOffsetMs: s.start_offset_ms ?? 0,
    durationMs: s.duration_ms ?? 0,
  };
}

export interface UseReviewingFetchParams {
  phase: Phase;
  setPhase: (p: Phase) => void;
  activeSessionId: string | null;
  refetchToken: number;
  bubbles: Bubble[];
  appendBubble: ThreadHandle["appendBubble"];
  /** Parent-owned; written by `revealNextSnippet` here, read+deleted
   *  by `handleSnippetLabel` in the labeling chain. */
  actionBubbleInfoRef: MutableRefObject<
    Map<string, { bubbleId: string; snippetType: "charisma" | "stress" }>
  >;
  /** Owned by `useSnippetLabelingChain`, passed in so the reviewing
   *  fetch can skip snippets whose closer chain already fired on a
   *  previous mount (spec C5 idempotency). */
  closedOutSnippetIdsRef: MutableRefObject<Set<string>>;
}

export function useReviewingFetch({
  phase,
  setPhase,
  activeSessionId,
  refetchToken,
  bubbles,
  appendBubble,
  actionBubbleInfoRef,
  closedOutSnippetIdsRef,
}: UseReviewingFetchParams): void {
  /**
   * Narrow mirror for the async polling closure. We deliberately
   * mirror only the SINGLE BOOLEAN the closure reads, not the
   * whole `bubbles` array — including `bubbles` in the polling
   * effect's deps would tear down + rebind the 30s interval on
   * every render, which (because bubbles change frequently) means
   * the interval would never actually fire. The ref-mirror is the
   * accepted React pattern for "read latest value inside a stable
   * interval"; we just keep the mirrored surface as small as
   * possible so the "did we forget to update the mirror" bug
   * class is one bit instead of an array.
   */
  const hasActionPending = bubbles.some((b) => b.kind === "action_pending");
  const hasActionPendingRef = useRef(hasActionPending);
  useEffect(() => {
    hasActionPendingRef.current = hasActionPending;
  }, [hasActionPending]);

  /**
   * Serial-reveal queue for snippet review. Snippets fetched by the
   * reviewing effect land here; `revealNextSnippet` pops one at a
   * time into the thread. We use a ref (not state) because the
   * mutations are paired with bubble appends that already drive
   * the UI re-render; tracking the queue in React state would just
   * double the work. With the closer-out chain in place (PR #19),
   * only the FIRST queued snippet of a session is typically
   * labeled — the user then transitions into recording. Remaining
   * queue entries are abandoned for this mount; on re-entry the
   * fetch re-queues them, the closed-out set skips the labeled
   * one, and the next unlabeled snippet starts the cycle again.
   */
  const snippetQueueRef = useRef<SnippetPlayerData[]>([]);

  /* ---------------------------------------------------------------------- */
  /*  Polling: while the user is in Q&A and waiting on their session to    */
  /*  publish, probe status until "completed" and then flip into review.   */
  /*  Fires for both the post-signup welcome path AND the returning-user   */
  /*  pending path (both end up in phase=q_and_a with an activeSessionId). */
  /* ---------------------------------------------------------------------- */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Task 8: once-per-session-mount guard so the metrics_ready
   *  bubble cascade (metrics + commentary + pending chip) fires
   *  exactly once when the BE flips metrics_ready→true. Without
   *  this, every 5s probe tick would re-append the bubbles. Reset
   *  on phase / sessionId change via the effect's cleanup. */
  const metricsReadyFiredRef = useRef(false);
  useEffect(() => {
    if (phase !== "q_and_a" || !activeSessionId) return;

    let cancelled = false;
    const probe = async () => {
      try {
        const res = await fetch(
          `/api/results/${encodeURIComponent(activeSessionId)}/status`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        if (!res.ok) return;
        const data = (await res.json()) as {
          status?: string;
          metrics_ready?: boolean;
          snippets_published?: boolean;
        };
        if (cancelled) return;

        // Back-compat: BE that hasn't shipped the new booleans yet
        // returns just `status`. Map "completed" → snippets_published.
        const snippetsPublished =
          data.snippets_published === true || data.status === "completed";
        const metricsReady = data.metrics_ready === true;

        // Task 8: metrics-computed-but-snippets-pending branch. Emit
        // the user-facing summary bubbles (metrics + commentary +
        // pending chip) ONCE per session. The user stays in q_and_a
        // so they can keep asking questions; the bubbles just land
        // inline in the thread.
        if (
          metricsReady &&
          !snippetsPublished &&
          !metricsReadyFiredRef.current
        ) {
          metricsReadyFiredRef.current = true;
          const summary = await fetchUserSessionSummary(activeSessionId);
          if (!cancelled && summary) {
            appendBubble({
              kind: "metrics",
              data: mapSummaryMetricsToBubble(summary.metrics),
            });
            if (summary.commentary?.body?.trim()) {
              for (const b of botBubblesFromText(
                summary.commentary.body.trim()
              )) {
                appendBubble(b);
              }
            }
            const n = summary.snippet_count_pending;
            const pendingCopy =
              n > 0
                ? `Your coach is reviewing ${n} snippet${
                    n === 1 ? "" : "s"
                  } — they'll appear here when ready.`
                : "Your coach is reviewing — snippets will appear here when ready.";
            for (const b of botBubblesFromText(pendingCopy)) {
              appendBubble(b);
            }
          }
        }

        if (snippetsPublished) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setPhase("reviewing");
        }
      } catch {
        /* silent — interval will retry */
      }
    };
    void probe();
    pollRef.current = setInterval(probe, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      // Reset the once-per-mount guard so a future re-entry (e.g.
      // navigating away and back to /chat) can re-fire the
      // metrics_ready bubbles on the new session.
      metricsReadyFiredRef.current = false;
    };
    // refetchToken bumps when usePublishLiveSubscription fires a
    // Realtime / fallback-poll event — we re-bind the effect so the
    // first `probe()` runs immediately, catching the "completed"
    // status the moment admin publishes (no 5s wait).
  }, [phase, activeSessionId, refetchToken, setPhase, appendBubble]);

  /**
   * Reveal the next snippet in `snippetQueueRef` into the thread.
   * Appends a `snippet` bubble + a fresh `action_pending` bubble and
   * registers the action-bubble info in `actionBubbleInfoRef` so the
   * panel's Yes/No click handler can look up snippetType on click.
   * No-op when the queue is empty — that's how the chain drains.
   * Called from the reviewing-fetch (initial reveal + polling tick).
   */
  const revealNextSnippet = useCallback(() => {
    const next = snippetQueueRef.current.shift();
    if (!next) return;
    appendBubble({ kind: "snippet", data: next });
    const bid = appendBubble({
      kind: "action_pending",
      snippetId: next.id,
      snippetType: next.type,
      submitting: false,
    });
    actionBubbleInfoRef.current.set(next.id, {
      bubbleId: bid,
      snippetType: next.type,
    });
  }, [appendBubble, actionBubbleInfoRef]);

  /* ---------------------------------------------------------------------- */
  /*  Reviewing transition + ongoing publish polling                        */
  /*                                                                          */
  /*  When phase=reviewing this effect:                                      */
  /*    1. Fetches /api/results/<sid>/snippets immediately (initial load)  */
  /*       — populates dashboard / contrast / queue / first reveal.         */
  /*    2. Keeps polling every REVIEW_REFRESH_MS while the surface is       */
  /*       still on the reviewing phase. On each tick: re-fetch, diff       */
  /*       against `seenSnippetIdsRef`, and ONLY append snippets whose id  */
  /*       isn't seen yet. Newly admin-re-published snippets land without  */
  /*       a page reload (acceptance criterion #1).                         */
  /*                                                                          */
  /*  The "no snippets yet" empty-state bubble fires only on the INITIAL    */
  /*  fetch — subsequent ticks suppress it so a re-publish that adds the   */
  /*  first snippet doesn't render alongside a stale "no snippets" message.*/
  /*                                                                          */
  /*  Idempotency: dashboard + contrast bubbles also fire once via         */
  /*  reviewLoadedRef. The seen-ids set is the source of truth for       */
  /*  snippet append; reviewLoadedRef gates only the one-time augmentations.*/
  /* ---------------------------------------------------------------------- */
  const reviewLoadedRef = useRef<string | null>(null);
  const seenSnippetIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (phase !== "reviewing" || !activeSessionId) return;
    // Reset seen-set when the active session changes — different
    // sessions have different snippet id namespaces, leaking would
    // suppress new ones.
    if (reviewLoadedRef.current !== activeSessionId) {
      seenSnippetIdsRef.current = new Set();
    }

    let cancelled = false;
    const load = async (isInitial: boolean) => {
      try {
        const res = await fetch(
          `/api/results/${encodeURIComponent(activeSessionId)}/snippets`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        if (!res.ok) {
          // Only complain on the initial load — a transient poll failure
          // shouldn't spam an error bubble every 30s.
          if (isInitial) {
            for (const b of botBubblesFromText(
              "Couldn't load this session's snippets."
            )) {
              appendBubble(b);
            }
          }
          return;
        }
        const data = (await res.json()) as {
          snippets?: Array<Parameters<typeof mapBackendSnippet>[0]>;
          charisma_profile?: {
            trinity?: { power?: number; warmth?: number; presence?: number };
          } | null;
          contrast?: unknown;
        };
        if (cancelled) return;

        if (isInitial) {
          // One-time augmentations: dashboard + contrast card. These
          // are stable for the session — backend doesn't republish
          // them per snippet drop, so we don't refetch them on
          // subsequent ticks.
          if (data.charisma_profile?.trinity) {
            appendBubble({
              kind: "dashboard",
              data: {
                trinity: {
                  power: data.charisma_profile.trinity.power ?? 0,
                  warmth: data.charisma_profile.trinity.warmth ?? 0,
                  presence: data.charisma_profile.trinity.presence ?? 0,
                },
              },
            });
          }
          // Stress-Contrast (BE-3) — null when underpowered, then we
          // render nothing per matrix C7.
          const contrastData = parseStressContrast(data.contrast);
          if (contrastData) {
            appendBubble({ kind: "contrast", data: contrastData });
          }
          reviewLoadedRef.current = activeSessionId;
        }

        const snippets = Array.isArray(data.snippets) ? data.snippets : [];
        if (isInitial && snippets.length === 0) {
          for (const b of botBubblesFromText(
            "No snippets came through for this session — your coach is still preparing your insights."
          )) {
            appendBubble(b);
          }
          return;
        }

        // Diff against seen ids — append only NEW snippet ids. The
        // mapped snippets go onto the serial-reveal queue; if the
        // queue is empty AND no labeled snippet is currently active
        // we reveal the next one immediately. Otherwise the new
        // snippets land in the queue for the next followup→reveal
        // cycle to drain.
        // Idempotency (spec C5): SKIP snippets that already closed
        // out — their full bubble chain ran on a previous mount and
        // re-firing the Y/N + thanks + intro sequence would be a
        // UX regression. They stay in the thread as historical
        // context (the snippet bubbles were already appended); we
        // just don't re-queue them for serial reveal.
        const incoming = snippets
          .filter(
            (s) =>
              !seenSnippetIdsRef.current.has(s.id) &&
              !closedOutSnippetIdsRef.current.has(s.id)
          )
          .map(mapBackendSnippet);
        if (incoming.length === 0) return;
        for (const s of incoming) seenSnippetIdsRef.current.add(s.id);
        snippetQueueRef.current.push(...incoming);
        // Only auto-reveal when no action_pending is in flight.
        // Once a snippet is labeled and the closer chain runs
        // (thanks → intro → recording_ready), the user transitions
        // into recording; remaining queued snippets sit idle until
        // the next mount, when the closed-out skip-filter above
        // re-picks the first unlabeled one for the cycle.
        if (!hasActionPendingRef.current) {
          revealNextSnippet();
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("chat.reviewing_fetch_failed surface=fe", err);
        if (isInitial) {
          for (const b of botBubblesFromText(
            "Couldn't load this session's snippets."
          )) {
            appendBubble(b);
          }
        }
      }
    };

    void load(true);
    const intervalId = setInterval(() => {
      void load(false);
    }, REVIEW_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
    // refetchToken: same trigger as above — Realtime / fallback-poll
    // bumps it and we run the immediate `load(false)` to diff for
    // newly-published snippets without waiting up to 30s for the
    // existing interval tick.
  }, [
    phase,
    activeSessionId,
    refetchToken,
    appendBubble,
    closedOutSnippetIdsRef,
    revealNextSnippet,
  ]);
}
