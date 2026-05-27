"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import ChatInterview from "@/components/funnel/ChatInterview";
import {
  AcousticMetricsBubble,
  TextBubble,
  TypingBubble,
  type AcousticMetricsBubbleData,
  type SnippetPlayerData,
} from "@/components/chat/RichBubbles";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { BottomSlot } from "@/components/chat/BottomSlot";
import { YesNoPills } from "@/components/chat/slots";
import { RecordingReadyPanel } from "@/components/chat/RecordingReadyPanel";
import { computeLabelBool, snippetLabelPrompt } from "@/lib/chat/snippetLabel";
import {
  loadClosedOutSnippets,
  markClosedOut,
} from "@/lib/chat/closedOutSnippets";
import { usePublishLiveSubscription } from "@/hooks/usePublishLiveSubscription";
import { createClient as createSupabaseBrowser } from "@/lib/supabase/client";
import { postChatQuery } from "@/services/api/chatQuery";
import ThreadView from "@/components/chat/thread/ThreadView";
import { deriveToolbar } from "@/components/chat/thread/toolbar";
import { useThread } from "@/components/chat/thread/useThread";
import type { BubbleInput, Phase } from "@/components/chat/thread/types";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/lib/api/auth-client";
import {
  GuestUploadFailure,
  USER_UPLOAD_MAX_BYTES,
  uploadUserFile,
} from "@/lib/api/public-client";
import { splitAiBubbleText } from "@/lib/chat/bubbleSplit";
import { parseStressContrast } from "@/lib/chat/stressContrast";
import { setPendingSessionId } from "@/lib/funnel/pendingSession";
import {
  consumePostOnboardingWelcome,
  setPostOnboardingWelcome,
} from "@/lib/funnel/postOnboardingWelcome";
import { useSessionRouteGuard } from "@/lib/session/useSessionRouteGuard";

/* -------------------------------------------------------------------------- */
/*  Single-Surface architecture                                                */
/*                                                                            */
/*  Per the "TRUE Single-Surface" spec, /chat hosts ONE chat thread; we     */
/*  no longer swap between ChatInterview / ChatReview / ChatQA mounts. The   */
/*  recording surface (ChatInterview) is mounted only during the recording  */
/*  phases (onboarding, compiling, metrics_ask, roleplaying) since it owns  */
/*  the mic engine + threshold logic. Every OTHER phase (welcome_back,      */
/*  q_and_a, reviewing) renders bubbles inline from a SINGLE shared         */
/*  `bubbles: Bubble[]` array owned by `useThread` — same array, same       */
/*  ThreadView renderer, whether the user is reading welcome bubbles,       */
/*  asking Q&A questions, or reviewing snippets. ChatReview has been        */
/*  deleted.                                                                */
/*                                                                            */
/*  The bottom toolbar is a strict state machine — see `bottomMode` below.  */
/*                                                                            */
/*  Phases:                                                                   */
/*    loading        — initial auth probe                                    */
/*    onboarding     — 30s cold-start ChatInterview (anonymous + first-     */
/*                     time signed-in with no session)                       */
/*    compiling      — TypingBubble in-thread while metrics process          */
/*    metrics_ask    — AcousticMetricsBubble + "we need a human" + signup   */
/*    welcome_back   — post-signup, push welcome bubbles, → q_and_a         */
/*    q_and_a        — persistent KB-backed Q&A. Handles all three of:     */
/*                     (a) just-signed-up users in the welcome flow         */
/*                     (b) signed-in returning users whose session is still */
/*                         processing — greeted with a pending notice +     */
/*                         live Q&A composer + background polling           */
/*                     (c) post-publish snippet review — snippet/action/    */
/*                         dashboard bubbles are pushed into the same       */
/*                         bubbles array as Q&A text                        */
/*    reviewing      — pure state marker; uses the same render path as     */
/*                     q_and_a. Transition target for the polling effect   */
/*                     so the parent knows to fetch + emit snippet bubbles. */
/*    roleplaying    — 120s practice ChatInterview, new session              */
/*    error          — rate-limit / funnel-disabled / fatal load failure    */
/* -------------------------------------------------------------------------- */

const POLL_INTERVAL_MS = 5_000;
/**
 * Re-fetch the reviewing-phase snippets endpoint every 30s so admin
 * re-publishes land on an already-open chat without the user logging
 * out. Idempotent — only NEW snippet ids (vs `seenSnippetIdsRef`)
 * get appended. See the reviewing effect for the full diff logic.
 */
const REVIEW_REFRESH_MS = 30_000;
const ROLEPLAY_CAP_SECONDS = 120;
const ONBOARDING_CAP_SECONDS = 30;
/**
 * Mocked compile delay between the 30s cap and the metrics reveal.
 * Real backend will eventually return synchronously from finalize with
 * the aggregate; until it does, this hold simulates the moment for
 * UX testing.
 */
const COMPILE_DELAY_MS = 1500;

/**
 * Bubble shape lives in @/components/chat/thread/types now —
 * shared across this surface AND (in FE Prompt 1b) ChatInterview.
 * See `Bubble` for the full discriminated union.
 */

/** Greeting copy shown to a returning user whose session is still
 *  processing — keeps them in the active Q&A surface instead of a
 *  static waiting page. Per the "pending users in active chat" spec. */
const PENDING_GREETING =
  "Your charisma snippets haven't arrived yet, but we can talk! " +
  "Do you have any questions or would you like to know more about " +
  "the voice analysis?";

/**
 * EF-4 fallback shown in place of `followup_text` when
 * `/v2/chat/snippet-followup` returns 5xx or empty. The closer
 * chain (continueAfterFollowup) still runs after this — the user
 * sees the soft fallback line, then thanks + intro + recording-
 * ready, never gets stuck on a per-snippet network error.
 */
const FOLLOWUP_FALLBACK = "Noted — let's keep going.";

/**
 * Closer-out copy fired by `continueAfterFollowup` once the
 * follow-up bubble has landed. Hard-coded FE string per spec C2 —
 * no BE call.
 */
const CLOSER_THANKS = "Thanks for that feedback!";

/**
 * Static fallback rendered when `/api/v2/coaching/intro-bubble`
 * returns non-200. The backend itself keeps a static fallback per
 * its contract, so a non-200 means a real outage — give the user
 * a clean one-liner and still close out into recording_ready.
 */
const INTRO_BUBBLE_FALLBACK =
  "Let's record a fresh take. Tap the mic below when you're ready.";

/** Visual breathing room between the followup bubble and the
 *  closer "Thanks for that feedback!". Short enough that the
 *  sequence still feels brisk; long enough to read as a beat. */
const CLOSER_BEAT_MS = 500;

/**
 * Helper — fan one logical AI text out into N bot bubbles, each ≤75
 * chars (Rule F). KB-sourced /v2/chat/query answers still pass
 * through this — the Master-Doc exemption is on COMPRESSION (the
 * model must not shorten grounded content to hit 75 chars), not on
 * visual segmentation, so long answers still get bubble-split here.
 *
 * Returns bubbles WITHOUT ids — `useThread`'s appendBubble generates
 * client-UUID ids at append time. Callers iterate and append each.
 */
function botBubblesFromText(text: string): BubbleInput[] {
  const chunks = splitAiBubbleText(text);
  return chunks.map((t) => ({
    kind: "bot_text" as const,
    text: t,
  }));
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

/* -------------------------------------------------------------------------- */
/*  Main                                                                      */
/* -------------------------------------------------------------------------- */

export default function ChatPageClient({
  sessionId,
}: {
  /** `?session=<id>` from the URL. Present after finalize redirects
   *  and admin email deep-links; null on the cold-start home /chat. */
  sessionId: string | null;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    sessionId
  );
  /**
   * Logged-in user id, hydrated once on mount via the browser
   * Supabase client. Used as the row-change filter for the
   * `v2_sessions` realtime subscription — anonymous users have no
   * row to watch, so `userId === null` is the no-op signal for
   * `usePublishLiveSubscription`. We don't subscribe to
   * onAuthStateChange because /chat is a full reload after OAuth,
   * not a same-tab sign-in.
   */
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    try {
      const supabase = createSupabaseBrowser();
      supabase.auth
        .getUser()
        .then(({ data }) => {
          if (!cancelled) setUserId(data.user?.id ?? null);
        })
        .catch(() => {
          if (!cancelled) setUserId(null);
        });
    } catch {
      // Missing Supabase env (e.g. local dev without .env.local).
      // The realtime hook gracefully no-ops on null userId.
    }
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Refetch coordinator. Bumping `refetchToken` forces both the
   * status-probe effect AND the reviewing-snippets effect to re-run
   * immediately (they list it in their deps array). Used by:
   *   - `usePublishLiveSubscription` on a Realtime publish event
   *   - the same hook's 20s polling fallback
   * Both signals collapse onto the same code path so the realtime
   * fast path doesn't create a parallel render branch (matrix C2).
   */
  const [refetchToken, setRefetchToken] = useState(0);
  const triggerRefetch = useCallback(() => {
    setRefetchToken((t) => t + 1);
  }, []);
  usePublishLiveSubscription(userId, triggerRefetch);

  // Hydrate the closed-out Set from localStorage when userId lands.
  // Per-user key so two accounts on one browser don't bleed each
  // other's lists. No-op when anonymous.
  useEffect(() => {
    if (!userId) return;
    setClosedOutSnippetIds(loadClosedOutSnippets(userId));
  }, [userId]);
  /** Anonymous session id captured during the cold-start onboarding —
   *  needed for the post-signup claim. */
  const anonSessionIdRef = useRef<string | null>(null);
  /**
   * Live accumulator for per-turn `metrics` blobs that
   * ChatInterview.onMetricsCapture forwards up. Merged shallow-last-
   * wins (latest turn's keys overwrite earlier ones) so the metrics
   * bubble shows the freshest read. Backend may eventually return one
   * aggregate from finalize, at which point this ref becomes
   * redundant — but it works today against the existing per-turn
   * pipeline.
   */
  const metricsAccumRef = useRef<Record<string, unknown>>({});
  /** Frozen snapshot of metricsAccumRef taken when entering the
   *  metrics_ask phase so re-renders don't reshuffle the bubble. */
  const [metricsSnapshot, setMetricsSnapshot] =
    useState<AcousticMetricsBubbleData | null>(null);

  /* Unified bubble thread — one array, one source of truth, mounted
     once via useThread. Every non-recording bubble (welcome,
     pending greeting, Q&A text, KB answers, dashboard, snippets,
     action prompts, upload status) lives here. ChatInterview's
     recording bubbles still live in its internal state for now;
     FE Prompt 1b lifts those too. */
  const {
    bubbles,
    appendBubble,
    updateBubble,
    replaceBubble,
    clearBubbles,
  } = useThread();
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
  /** Map of snippetId → action-bubble info ({id, snippetType}), so the
   *  inline ThreadView onActionSelect handler can route a click into
   *  the existing `submitting` / replace-with-user-text-echo lifecycle
   *  without scanning the bubbles array. snippetType is mirrored here
   *  because the action_pending bubble itself is removed on replace,
   *  but the label-text echo computation needs it. */
  const actionBubbleInfoRef = useRef<
    Map<string, { bubbleId: string; snippetType: "charisma" | "stress" }>
  >(new Map());
  const [qaSubmitting, setQaSubmitting] = useState(false);
  /**
   * Per-turn upload-intent signal from /v2/chat/query (Rule G).
   * Backend flips this true when it detects "I want to upload / can
   * I upload / here is my file" intent in the user's question; flips
   * back to false on the next non-intent turn. Frontend uses it to
   * reveal the paperclip on the QAInput — default hidden so the
   * Q&A composer doesn't dangle an affordance the user can't act on
   * meaningfully unless the AI just suggested an upload.
   */
  const [showUploadUi, setShowUploadUi] = useState(false);
  /**
   * Per-turn record-intent signal from /v2/chat/query — peer of
   * showUploadUi. Backend flips true when it detects "can I just
   * record it here?" / "let me try it out loud" intent. Frontend
   * uses it to visually emphasise the always-present mic (a pulsing
   * primary-tint ring) so the user notices voice is an inviting
   * answer mode on this turn. The mic itself is unchanged — it
   * still POSTs multipart audio to /v2/chat/query for the casual
   * voice analytics path. Mutually exclusive with showUploadUi in
   * practice (backend won't return both true on the same turn);
   * both false is the neutral default.
   */
  const [showRecordUi, setShowRecordUi] = useState(false);
  /** True while a user-initiated file upload is in flight. Disables
   *  the QAInput composer + paperclip so the user can't double-fire. */
  const [uploadingFile, setUploadingFile] = useState(false);
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

  /**
   * Snippet-label closer-out tracking (spec C5). Each snippet whose
   * full chain — Y/N → label → followup → thanks → intro — has
   * fired ends up in this Set, persisted per-user via localStorage.
   * Re-mounting the page (client nav back from /dashboard, hard
   * reload) re-hydrates this and skips snippet-queue entries that
   * already closed out, so the auto-bubbles don't replay.
   */
  const [closedOutSnippetIds, setClosedOutSnippetIds] = useState<Set<string>>(
    () => new Set()
  );
  // Ref mirror so async closures inside `handleSnippetLabel` /
  // reviewing fetch read the latest set without re-creating
  // callbacks every time the state changes.
  const closedOutSnippetIdsRef = useRef<Set<string>>(closedOutSnippetIds);
  useEffect(() => {
    closedOutSnippetIdsRef.current = closedOutSnippetIds;
  }, [closedOutSnippetIds]);

  /**
   * Set true once `continueAfterFollowup` finishes (intro bubble
   * landed). Drives the `recording_ready` toolbar mode. Reset to
   * false the moment the user taps the big mic (phase=roleplaying
   * takes over; ChatInterview's own mic UI mounts).
   */
  /**
   * Drives the `recording_ready` toolbar mode. Holds the id of the
   * snippet whose closer chain just finished; null = not in the
   * recording-ready state. Set by `continueAfterFollowup`; cleared
   * when the multipart upload completes (and `awaitingAdminReview`
   * takes over) or when the user navigates to a recording phase.
   * String-typed (not boolean) so the upload knows which snippet
   * to attach `source_snippet_id` to.
   */
  const [recordingReadyForSnippetId, setRecordingReadyForSnippetId] =
    useState<string | null>(null);
  /**
   * True between a successful post-labeling upload and the next
   * admin publish landing in the thread. Renders no toolbar — the
   * user waits, no chat. Cleared the moment a fresh action_pending
   * bubble is revealed (deriveToolbar's label_buttons branch wins
   * before this even gets read, but we still flip the flag for
   * code clarity).
   */
  const [awaitingAdminReview, setAwaitingAdminReview] = useState(false);

  // Loop guard runs ONLY for the param-less /chat. With `?session=` in
  // the URL we're deliberately deep-linked; the guard would yank us
  // away. And on the welcome-back hop we also disable the guard via
  // the localStorage flag (handled below) so the post-signup user
  // doesn't get bounced to /chat?session=<id>.
  const welcomeFlagRef = useRef<boolean | null>(null);
  if (welcomeFlagRef.current === null) {
    // Run once on first render so the guard can react synchronously.
    welcomeFlagRef.current = consumePostOnboardingWelcome();
  }
  const guard = useSessionRouteGuard({
    enabled: !sessionId && !welcomeFlagRef.current,
  });

  /* ---------------------------------------------------------------------- */
  /*  Initial phase routing                                                 */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (guard.checking || guard.redirecting) return;

    // Welcome flag wins: user just signed up after onboarding.
    if (welcomeFlagRef.current) {
      setPhase("welcome_back");
      return;
    }

    if (sessionId) {
      // Returning user with an in-flight session. Per the "pending
      // users in active chat" spec, we DON'T show a static waiting
      // screen — drop them straight into Q&A with a pending-snippets
      // greeting. The polling effect below promotes them to the
      // review surface the moment the admin publishes. If the session
      // is already completed when we land here, the initial status
      // probe inside the polling effect flips us to "reviewing"
      // before the greeting ever paints. Greeting is run through the
      // 75-char bubble splitter so a long string fans out into
      // multiple snappy bubbles.
      clearBubbles();
      for (const b of botBubblesFromText(PENDING_GREETING)) appendBubble(b);
      setPhase("q_and_a");
      return;
    }

    // No session, no welcome flag → record a fresh cold-start.
    setPhase("onboarding");
  }, [sessionId, guard.checking, guard.redirecting]);

  /* ---------------------------------------------------------------------- */
  /*  Welcome-back → push two bubbles → flip to Q&A                        */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (phase !== "welcome_back") return;
    // Both welcome strings go through the 75-char splitter for
    // consistency — "Thanks, check…" fits in one bubble, the longer
    // "Do you have any questions…" question splits into two snappy
    // beats.
    clearBubbles();
    for (const b of botBubblesFromText(
      "Thanks, check your email in a few hours."
    )) {
      appendBubble(b);
    }
    for (const b of botBubblesFromText(
      "Do you have any questions or would you like to know more about the voice analysis?"
    )) {
      appendBubble(b);
    }
    // Tiny breath so the user reads "Thanks…" before the input row
    // mounts; otherwise it feels abrupt.
    const t = setTimeout(() => setPhase("q_and_a"), 400);
    return () => clearTimeout(t);
  }, [phase]);

  /* ---------------------------------------------------------------------- */
  /*  Polling: while the user is in Q&A and waiting on their session to    */
  /*  publish, probe status until "completed" and then flip into review.   */
  /*  Fires for both the post-signup welcome path AND the returning-user   */
  /*  pending path (both end up in phase=q_and_a with an activeSessionId). */
  /* ---------------------------------------------------------------------- */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
        const data = (await res.json()) as { status?: string };
        if (cancelled) return;
        if (data.status === "completed") {
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
    };
    // refetchToken bumps when usePublishLiveSubscription fires a
    // Realtime / fallback-poll event — we re-bind the effect so the
    // first `probe()` runs immediately, catching the "completed"
    // status the moment admin publishes (no 5s wait).
  }, [phase, activeSessionId, refetchToken]);

  /* ---------------------------------------------------------------------- */
  /*  Compile delay → metrics_ask                                           */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (phase !== "compiling") return;
    const t = setTimeout(() => {
      setMetricsSnapshot(summariseMetrics(metricsAccumRef.current));
      setPhase("metrics_ask");
    }, COMPILE_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase]);

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
  }, [appendBubble]);

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
        console.warn("reviewing fetch failed:", err);
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
  }, [phase, activeSessionId, refetchToken]);

  /**
   * Steps 7-10 of the snippet-label chain — auto-fires AFTER the
   * follow-up bubble lands, regardless of whether the BE returned
   * real `followup_text` (5a) or we rendered the EF-4 static
   * FOLLOWUP_FALLBACK (5b). Sequence:
   *
   *   500ms beat → "Thanks for that feedback!" bubble
   *              → POST /api/v2/coaching/intro-bubble
   *              → intro_text bubble (or static FE fallback)
   *              → mark snippet closed-out (persist)
   *              → setRecordingReadyForSnippetId(id) — panel swaps to big mic
   *
   * Idempotency (C5): the closed-out check happens in the reviewing-
   * fetch effect, not here — if the snippet was already in the set
   * when the page mounted, no action_pending bubble ever appeared,
   * so this function is never reached.
   */
  const continueAfterFollowup = useCallback(
    async (snippetId: string) => {
      // Closer beat — give the followup bubble visual breathing room.
      await new Promise((resolve) => setTimeout(resolve, CLOSER_BEAT_MS));

      for (const b of botBubblesFromText(CLOSER_THANKS)) appendBubble(b);

      // BE call for the personalized intro line. Per spec C3, the
      // BE itself keeps a static fallback so a 200 is the normal
      // case even on its internal LLM failure; a non-200 from this
      // route is a real outage and the FE has its own one-liner.
      let introText = INTRO_BUBBLE_FALLBACK;
      try {
        const res = await fetch("/api/v2/coaching/intro-bubble", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ snippet_id: snippetId }),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            intro_text?: string;
          };
          if (typeof data.intro_text === "string" && data.intro_text.trim()) {
            introText = data.intro_text.trim();
          }
        }
      } catch (err) {
        console.warn("intro-bubble POST failed:", err);
      }
      for (const b of botBubblesFromText(introText)) appendBubble(b);

      // Persist closed-out before flipping recording-ready so a
      // mid-render re-mount (which can happen on React StrictMode
      // double-effect in dev) doesn't replay the chain. The
      // snippet id rides through the toolbar via
      // `recordingReadyForSnippetId` so the multipart upload
      // attaches to the right context.
      setClosedOutSnippetIds((prev) =>
        markClosedOut(userId, prev, snippetId)
      );
      setRecordingReadyForSnippetId(snippetId);
      // Defensive: a fresh closer chain should not start in the
      // post-upload idle state. Reset awaitingAdminReview in case
      // the user re-entered the chat after a successful upload AND
      // a new snippet got labeled in the same session.
      setAwaitingAdminReview(false);
    },
    [appendBubble, userId]
  );

  /* ---------------------------------------------------------------------- */
  /*  Snippet-label resolution (Yes/No flow + closer-out chain)             */
  /*                                                                          */
  /*  Per the BE contract:                                                  */
  /*    1. POST /api/v2/user/snippets/<id>/label   `{ label: boolean }`    */
  /*    2. REPLACE action_pending with "Yes" / "No" user-text echo         */
  /*    3. APPEND a typing bubble                                          */
  /*    4. POST /api/v2/chat/snippet-followup     `{snippet_id, user_label}`*/
  /*    5a. 200 + followup_text → REPLACE typing with bubble-split text   */
  /*    5b. 5xx / empty → REPLACE typing with static FOLLOWUP_FALLBACK    */
  /*    6+. continueAfterFollowup runs in both branches — thanks bubble,   */
  /*        intro-bubble POST, recording_ready transition. The closer     */
  /*        chain is the ONLY post-follow-up exit; the user does not      */
  /*        reply to the followup in this surface.                         */
  /*                                                                          */
  /*  Error handling per spec C4:                                           */
  /*    - Label POST fail → rollback submitting; user can re-click.        */
  /*    - Followup POST fail → label saved; soft FOLLOWUP_FALLBACK;       */
  /*      closer still fires (continueAfterFollowup always runs after the */
  /*      followup bubble is rendered, regardless of branch).             */
  /* ---------------------------------------------------------------------- */
  const handleSnippetLabel = useCallback(
    async (snippetId: string, answer: "yes" | "no") => {
      const info = actionBubbleInfoRef.current.get(snippetId);
      if (!info) return;
      const { bubbleId, snippetType } = info;

      // Canonical bool — see `computeLabelBool` for the truth table.
      const labelBool = computeLabelBool(snippetType, answer);
      // User-text echo is just their literal Yes/No — keeps the
      // thread readable without leaking the charisma/stress framing
      // into the user's voice.
      const echoText = answer === "yes" ? "Yes" : "No";

      // qaSubmitting locks the composer across the entire chain
      // (matrix LI-4a/LI-4b). Reset in every terminal branch below.
      updateBubble(bubbleId, { submitting: true });
      setQaSubmitting(true);

      // Step 1 — record the user_charisma_label boolean.
      let labelOk = false;
      try {
        const res = await fetch(
          `/api/v2/user/snippets/${encodeURIComponent(snippetId)}/label`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: labelBool }),
          }
        );
        labelOk = res.ok;
      } catch (err) {
        console.warn("label POST failed:", err);
      }
      if (!labelOk) {
        // Rollback per spec C4: nothing committed to the thread,
        // bubble returns to clickable state, user can retry.
        updateBubble(bubbleId, { submitting: false });
        setQaSubmitting(false);
        return;
      }

      // Step 2 — user-text echo of the Yes/No pick.
      replaceBubble(bubbleId, { kind: "user_text", text: echoText });
      actionBubbleInfoRef.current.delete(snippetId);

      // Step 3 — typing bubble while the followup roundtrip is in flight.
      const typingId = appendBubble({ kind: "typing" });

      // Step 4 — POST /v2/chat/snippet-followup with the same bool.
      let followup = "";
      try {
        const res = await fetch("/api/v2/chat/snippet-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snippet_id: snippetId,
            user_label: labelBool,
          }),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            followup_text?: string;
            debug?: { user_label_interpretation?: string };
          };
          // Dev-only contract guard (probe v1 FE-04). The matrix
          // pin in docs/PANEL-STATE-MATRIX.md fixes the semantic
          // backend uses for `user_label_interpretation`. If
          // backend ever flips it without coordinating, log loud
          // so engineering can update both sides.
          if (process.env.NODE_ENV !== "production") {
            const interpretation = data.debug?.user_label_interpretation;
            if (
              typeof interpretation === "string" &&
              interpretation !== "agreement"
            ) {
              console.warn(
                `snippet-followup contract: ` +
                  `debug.user_label_interpretation="${interpretation}" ` +
                  `(expected "agreement"). Update matrix pin if backend ` +
                  `intentionally flipped the semantic.`
              );
            }
          }
          if (typeof data.followup_text === "string") {
            followup = data.followup_text.trim();
          }
        }
      } catch (err) {
        console.warn("snippet-followup POST failed:", err);
      }

      // 5a (happy) vs 5b (EF-4 fallback) — same shape: render the
      // followup bubble (real text or fallback) then advance through
      // the closer chain. The closer auto-fires regardless of branch.
      const followupBubbles = botBubblesFromText(
        followup || FOLLOWUP_FALLBACK
      );
      replaceBubble(typingId, followupBubbles);
      setQaSubmitting(false);
      // Closer chain runs after the followup paint. We don't await
      // here so the user sees the followup bubble immediately;
      // continueAfterFollowup's own 500ms beat handles the cadence.
      void continueAfterFollowup(snippetId);
    },
    [
      updateBubble,
      replaceBubble,
      appendBubble,
      continueAfterFollowup,
    ]
  );

  /* ---------------------------------------------------------------------- */
  /*  Phase transition handlers                                             */
  /* ---------------------------------------------------------------------- */

  const handleChatComplete = useCallback(
    async (guestSessionId: string) => {
      // Branch by auth: anonymous onboarding stays in-chat to show
      // metrics + signup CTA; signed-in users (roleplay phase) hop to
      // the deep-linked waiting surface as before.
      const token = await getAuthToken();
      if (token) {
        const target = guestSessionId
          ? `/chat?session=${encodeURIComponent(guestSessionId)}`
          : "/chat";
        router.push(target);
        return;
      }
      // Anonymous: hold the session id for the eventual claim and
      // transition into the in-chat metrics flow.
      anonSessionIdRef.current = guestSessionId;
      setPhase("compiling");
    },
    [router]
  );

  const handleMetricsCapture = useCallback(
    (metrics: Record<string, unknown>) => {
      metricsAccumRef.current = {
        ...metricsAccumRef.current,
        ...metrics,
      };
    },
    []
  );

  const handleSignUpClick = useCallback(() => {
    // Stash both flags BEFORE the redirect — the OAuth round-trip
    // will destroy React state but localStorage survives. The global
    // PendingSessionClaim hook reads the pending session id post-auth
    // and merges; consumePostOnboardingWelcome on the /chat re-mount
    // routes the user into the welcome-back phase instead of the
    // generic WaitingScreen.
    if (anonSessionIdRef.current) {
      setPendingSessionId(anonSessionIdRef.current);
    }
    setPostOnboardingWelcome();
    // Send the user through the existing /login flow. mode=signup
    // hints the form to default to the sign-up tab; redirectTo brings
    // them back here.
    router.push("/login?mode=signup&redirectTo=/chat");
  }, [router]);

  const handleChatError = useCallback((code: string) => {
    if (code === "RATE_LIMITED") {
      setErrorMsg("Too many recordings. Please wait a few minutes and try again.");
      setPhase("error");
    } else if (code === "GUEST_FUNNEL_DISABLED") {
      setErrorMsg("Chat is temporarily unavailable. Please try again later.");
      setPhase("error");
    }
  }, []);

  const handleQASend = useCallback(
    async (
      question: string,
      audioBlob: Blob | null,
      durationSec: number | null
    ): Promise<boolean> => {
      // Re-entrant guard. Return false so ChatInputBar retains the
      // composer text — the user's input shouldn't disappear just
      // because they tapped Send twice fast.
      if (qaSubmitting) return false;
      // 1) optimistic user bubble, 2) typing placeholder that gets
      // 1:N replaced with the answer chunks on completion. Keeps the
      // thread auto-scrolled and avoids a separate floating indicator.
      appendBubble({ kind: "user_text", text: question });
      const typingId = appendBubble({ kind: "typing" });
      setQaSubmitting(true);
      try {
        // chatQuery service branches the wire format: multipart when
        // an audio blob is present (dual-capture turn, BE-3 will pull
        // out `audio_file` for silent acoustic metrics), JSON when
        // not — preserving the C1 contract for typed-only sends.
        const data = await postChatQuery({
          question,
          audioBlob,
          durationSec,
          sessionId: activeSessionId,
        });
        // Rule G — per-turn signal. Always read these off every
        // /chat/query response, even on errors, so the flags never
        // get stuck on after a transient failure.
        setShowUploadUi(data.show_upload_ui === true);
        setShowRecordUi(data.show_record_ui === true);
        if (data.answer) {
          // KB-sourced answer. Rule F clarifies: the Master-Doc
          // exemption is on COMPRESSION (backend must not shorten
          // grounded content to hit 75 chars), not on visual
          // segmentation. Long answers still get bubble-split at
          // natural boundaries for readability.
          replaceBubble(typingId, botBubblesFromText(data.answer));
          return true;
        }
        // Backend error envelope — first-party AI copy, follows
        // the 75-char rule like every other bot bubble. We return
        // false so ChatInputBar keeps the input + mic state for
        // the user to edit and retry (FE-10).
        const fallback =
          data.error ?? "Couldn't reach the coach. Try again in a moment.";
        replaceBubble(typingId, botBubblesFromText(fallback));
        return false;
      } catch {
        replaceBubble(
          typingId,
          botBubblesFromText("Couldn't reach the coach. Try again in a moment.")
        );
        // Network failure → both intent signals are stale data from
        // the previous turn. Reset to false so neither the paperclip
        // nor the record-emphasis pulse keep dangling after a fetch
        // error.
        setShowUploadUi(false);
        setShowRecordUi(false);
        return false;
      } finally {
        setQaSubmitting(false);
      }
    },
    [qaSubmitting, activeSessionId, appendBubble, replaceBubble]
  );

  /**
   * Single composer submit handler — forwards every submit to
   * /chat/query. The snippet-label followup chain no longer
   * intercepts composer submits (the closer-out auto-advance
   * replaced the "user replies to followup → bridge → next
   * snippet" pattern in PR #19). Returns handleQASend's boolean
   * so ChatInputBar can decide whether to clear the composer on
   * the FE-10 retry-on-error contract.
   */
  const handleComposerSubmit = useCallback(
    (args: {
      text: string;
      audioBlob: Blob | null;
      durationSec: number | null;
    }): Promise<boolean> =>
      handleQASend(args.text, args.audioBlob, args.durationSec),
    [handleQASend]
  );

  /**
   * Q&A file-upload handler — fires when the user picks a file via
   * the paperclip on QAInput (revealed only when the backend's last
   * /chat/query response carried `show_upload_ui: true`, Rule G).
   * On success/error, lands a one-line bot bubble in the thread so
   * the user has visible confirmation, and flips showUploadUi back
   * off so the paperclip hides until the next intent-signalled turn.
   */
  const handleQAFileUpload = useCallback(
    async (file: File) => {
      if (uploadingFile || qaSubmitting) return;
      const token = await getAuthToken();
      if (!token) {
        for (const b of botBubblesFromText(
          "Sign in to upload files — pre-recorded uploads need an account."
        )) {
          appendBubble(b);
        }
        return;
      }
      setUploadingFile(true);
      try {
        const result = await uploadUserFile(file, {
          sessionId: activeSessionId,
          authToken: token,
        });
        for (const b of botBubblesFromText(
          `File “${result.filename}” uploaded — your coach will review it.`
        )) {
          appendBubble(b);
        }
      } catch (err) {
        const message =
          err instanceof GuestUploadFailure
            ? err.code === "FILE_TOO_LARGE"
              ? `“${file.name}” is over the ${Math.round(
                  USER_UPLOAD_MAX_BYTES / 1024 / 1024
                )} MB limit.`
              : err.message
            : err instanceof Error
            ? err.message
            : "Couldn't upload the file.";
        for (const b of botBubblesFromText(
          `Couldn't upload “${file.name}” — ${message}`
        )) {
          appendBubble(b);
        }
      } finally {
        setUploadingFile(false);
        // Per Rule G, the upload-intent signal is per-turn — hide
        // the paperclip again until the next intent-signalled turn.
        setShowUploadUi(false);
      }
    },
    [activeSessionId, qaSubmitting, uploadingFile, appendBubble]
  );

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                */
  /* ---------------------------------------------------------------------- */

  if (guard.checking || guard.redirecting) {
    return (
      <main className="willab-chat flex h-full flex-col overflow-hidden bg-background">
        <div className="shrink-0">
          <DashboardHeader />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  return (
    <main className="willab-chat flex h-full flex-col overflow-hidden bg-background">
      <div className="shrink-0">
        <DashboardHeader />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-4 py-6">
        {phase === "loading" && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              {errorMsg || "Something went wrong."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/chat")}
            >
              Back to chat
            </Button>
          </div>
        )}

        {/* Onboarding → compiling → metrics_ask are now a SINGLE
            continuous ChatInterview mount per the "Single Surface"
            spec. ChatInterview is never unmounted between these
            phases — instead the parent appends trailing bubbles
            into the thread and swaps the bottom toolbar slot.
            That keeps the chat history visible the whole way
            through and avoids any "screen change" perception when
            the 30s cap fires. */}
        {(phase === "onboarding" ||
          phase === "compiling" ||
          phase === "metrics_ask") && (
          <ChatInterview
            onThresholdReached={handleChatComplete}
            onError={handleChatError}
            aggregateThresholdSeconds={ONBOARDING_CAP_SECONDS}
            onMetricsCapture={handleMetricsCapture}
            isGuest
            trailingBubbles={
              phase === "compiling" ? (
                <TypingBubble />
              ) : phase === "metrics_ask" && metricsSnapshot ? (
                <>
                  <AcousticMetricsBubble metrics={metricsSnapshot} />
                  {splitAiBubbleText(
                    "We need a human to give meaning to that raw data, " +
                      "and then we'll get back to you. For that we need " +
                      "you to sign up — so we know who to send the analysis to."
                  ).map((line, i) => (
                    <TextBubble key={`auth-ask-${i}`}>{line}</TextBubble>
                  ))}
                </>
              ) : null
            }
            bottomOverride={
              phase === "metrics_ask" ? (
                <div className="flex w-full flex-col items-center gap-2">
                  <Button
                    type="button"
                    size="lg"
                    onClick={handleSignUpClick}
                    className="w-full max-w-sm rounded-full bg-primary text-primary-foreground hover:shadow-lg"
                  >
                    Sign up to receive your analysis
                  </Button>
                  <p className="text-[10px] leading-tight text-muted-foreground">
                    Free account, no card. We&apos;ll email your snippets when
                    ready.
                  </p>
                </div>
              ) : null
            }
          />
        )}

        {phase === "roleplaying" && (
          <ChatInterview
            onThresholdReached={handleChatComplete}
            onError={handleChatError}
            aggregateThresholdSeconds={ROLEPLAY_CAP_SECONDS}
            farewellMessage="Nice work — let's see what the coach picks up from this round."
          />
        )}

        {/* SINGLE thread renderer for every non-recording phase —
            welcome_back / q_and_a / reviewing all share ThreadView
            against the same `bubbles` array. The reviewing fetch
            effect above appends snippet + action bubbles to the
            SAME array the user has been reading their pending-
            greeting / welcome / Q&A bubbles from.

            handleSnippetLabel is the inline action_pending click
            handler — it pulls the bubble id + snippetType from
            `actionBubbleInfoRef` and runs the existing label POST
            lifecycle (submitting toggle → user-text echo on
            success / rollback on error).

            Strict bottom toolbar state machine drives the bottom
            slot below. */}
        {(phase === "welcome_back" ||
          phase === "q_and_a" ||
          phase === "reviewing") && (
          <div className="flex flex-1 flex-col gap-3 overflow-hidden">
            <ThreadView bubbles={bubbles} />
            {/* Bottom-toolbar slot is derived from a pure function —
                see `deriveToolbar` (and its unit tests against the
                PANEL-STATE-MATRIX rows). Single source of truth for
                the toolbar mode; this JSX just renders the chosen
                variant. Per Rule G the paperclip is gated on the
                per-turn `showUploadUi` flag; while ActionBubbles
                are pending the qa_text composer stays mounted but
                the user's attention is on the inline YES/NO. */}
            {(() => {
              const mode = deriveToolbar({
                phase,
                bubbles,
                showUploadUi,
                recordingReadyForSnippetId,
                awaitingAdminReview,
              });
              switch (mode.kind) {
                case "none":
                  return null;
                case "composer":
                  return (
                    <BottomSlot widthClass="max-w-3xl">
                      <div className="flex justify-center">
                        <ChatInputBar
                          onSend={handleComposerSubmit}
                          submitting={qaSubmitting}
                          onUploadFile={
                            mode.showUpload ? handleQAFileUpload : undefined
                          }
                          uploading={uploadingFile}
                          emphasizeMic={showRecordUi}
                        />
                      </div>
                    </BottomSlot>
                  );
                case "label_buttons": {
                  // Matrix C-LI-4: mic + text input ABSENT from the
                  // DOM while labeling is active — only the Yes/No
                  // pills render in the toolbar slot. Prompt is
                  // mirrored above the pills for clarity (same copy
                  // as the bubble in the thread above, but the user
                  // shouldn't have to scroll back). `submitting`
                  // mirrors the action_pending bubble's flag so the
                  // spinner travels through the picked pill when the
                  // parent POST is in flight.
                  const actionBubble = bubbles.find(
                    (b) =>
                      b.kind === "action_pending" &&
                      b.snippetId === mode.snippetId
                  );
                  const labelSubmitting =
                    actionBubble?.kind === "action_pending"
                      ? actionBubble.submitting
                      : false;
                  return (
                    <BottomSlot widthClass="max-w-3xl">
                      <div className="mx-auto w-full max-w-md px-4 pb-4 pt-2">
                        <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
                          {snippetLabelPrompt(mode.snippetType)}
                        </p>
                        <YesNoPills
                          onPick={(value) =>
                            void handleSnippetLabel(mode.snippetId, value)
                          }
                          submitting={labelSubmitting}
                        />
                      </div>
                    </BottomSlot>
                  );
                }
                case "recording_ready": {
                  // Closer-out chain done. Inline mic + recorder
                  // engine via the canonical `VoiceRecordButton`
                  // (same big-mic visual the onboarding funnel
                  // uses). Multipart upload routes to
                  // /api/v2/user/chat/upload-answer with the
                  // closed-out snippet's id as `source_snippet_id`.
                  // On success the closer-out bubble lands + the
                  // panel transitions to `awaitingAdminReview`
                  // (none) until the next admin publish.
                  return (
                    <BottomSlot widthClass="max-w-3xl">
                      <RecordingReadyPanel
                        snippetId={mode.snippetId}
                        onRecordingCaptured={(audioUrl, durationSeconds) => {
                          // Optimistic user-audio bubble so the
                          // user sees their take in the thread the
                          // moment they stop recording, without
                          // waiting for the upload roundtrip.
                          appendBubble({
                            kind: "user_audio",
                            audioUrl,
                            duration: `${Math.floor(durationSeconds / 60)}:${String(
                              Math.floor(durationSeconds % 60)
                            ).padStart(2, "0")}`,
                          });
                        }}
                        onUploadComplete={() => {
                          for (const b of botBubblesFromText(
                            "Got it. Your coach is reviewing your new recording — you'll see the results when they're done."
                          )) {
                            appendBubble(b);
                          }
                          setRecordingReadyForSnippetId(null);
                          setAwaitingAdminReview(true);
                        }}
                      />
                    </BottomSlot>
                  );
                }
              }
            })()}
          </div>
        )}
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Map the raw per-turn metrics blob backend returns into the shape the
 * AcousticMetricsBubble renders. Tolerates both legacy short keys
 * (wpm, pitch, dynamic_db, …) and verbose backend keys
 * (speech_rate_wpm, pitch_mean_hz, dynamic_range_db, …) — same
 * permissive surface the admin snippet card uses.
 */
function summariseMetrics(
  raw: Record<string, unknown>
): AcousticMetricsBubbleData {
  const num = (k: string): number | null => {
    const v = raw[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const str = (k: string): string | null => {
    const v = raw[k];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  };

  const wpm = num("wpm") ?? num("speech_rate_wpm");
  // Pitch can come as a label ("C4") or as Hz / semitones. Prefer the
  // pre-formatted string when present; fall back to a Hz/st reading.
  let pitch: string | null = str("pitch");
  if (!pitch) {
    const hz = num("pitch_mean_hz");
    if (hz != null) pitch = `${Math.round(hz)} Hz`;
    else {
      const st = num("pitch_center_st");
      if (st != null) pitch = `${st.toFixed(1)} st`;
    }
  }

  // Flow isn't yet a first-class per-turn metric — approximate from
  // filler density when we can. 1 - normalised filler count, clamped.
  const fillers = num("fillers");
  const wpmForFlow = wpm ?? 130;
  let flow: number | null = null;
  if (fillers != null) {
    // Rough heuristic: <2 fillers/min = 100% flow, >8/min = 0% flow.
    const minutes = Math.max(0.1, wpmForFlow / 130);
    const fillerPerMin = fillers / minutes;
    flow = Math.max(0, Math.min(1, 1 - (fillerPerMin - 2) / 6));
  }

  const dynamicDb = num("dynamic_db") ?? num("dynamic_range_db");
  const energy = num("energy_ratio") ?? num("energy");

  return {
    wpm,
    pitch,
    flow,
    fillers,
    dynamicDb,
    energy,
  };
}
