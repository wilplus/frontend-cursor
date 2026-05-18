"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import ChatInterview from "@/components/funnel/ChatInterview";
import {
  AcousticMetricsBubble,
  MicButton,
  TextBubble,
  TypingBubble,
  UploadButton,
  type AcousticMetricsBubbleData,
  type SnippetPlayerData,
} from "@/components/chat/RichBubbles";
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
 * Bridge copy rotated between snippet reveals. Indexed round-robin
 * by `bridgeIndexRef` so a session with more snippets than entries
 * loops cleanly (cleaner than "Snippet 1 / 2 / 3" enumeration which
 * leaks implementation into the chat copy). Fires after the user
 * replies to a followup (or, in the EF-4 fallback path, right after
 * the static "Noted —" stand-in).
 */
const BRIDGES = [
  "Let's look at the next moment.",
  "Here's another one.",
  "And one more from your session.",
];

/**
 * EF-4 fallback shown in place of `followup_text` when
 * `/v2/chat/snippet-followup` returns 5xx or empty. Caller skips
 * directly to the bridge + next-snippet reveal — never blocks the
 * user on a per-snippet network error.
 */
const FOLLOWUP_FALLBACK = "Noted — let's keep going.";

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
  /** True while a user-initiated file upload is in flight. Disables
   *  the QAInput composer + paperclip so the user can't double-fire. */
  const [uploadingFile, setUploadingFile] = useState(false);
  /**
   * Serial-reveal state machine for snippet review (FE Prompt 3).
   *
   * `snippetQueueRef` — snippets fetched by the reviewing effect but
   * NOT yet revealed in the thread. Drains one at a time. We use a
   * ref (not state) because the mutations are paired with bubble
   * appends that already drive the UI re-render; tracking the queue
   * in React state would just double the work.
   *
   * `pendingFollowUp` — set true the moment the `/v2/chat/snippet-
   * followup` response lands and its bubble is in the thread. The
   * composer routes the next user submit to `handleFollowUpReply`
   * (which appends the reply + a bridge bubble + reveals the next
   * snippet) instead of the default `/chat/query`. Reset by
   * `handleFollowUpReply` after it processes the reply. Also passed
   * to `deriveToolbar` so `practice_cta` waits for the followup
   * chain to drain (matrix rows LI-4c / LI-4d).
   *
   * `bridgeIndexRef` — round-robin index into BRIDGES. Incremented
   * each time a bridge string is appended (both the happy
   * "user-replied" path and the EF-4 followup-error fallback path).
   */
  const snippetQueueRef = useRef<SnippetPlayerData[]>([]);
  const [pendingFollowUp, setPendingFollowUp] = useState(false);
  const bridgeIndexRef = useRef(0);

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
  }, [phase, activeSessionId]);

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
   * registers the action-bubble id in `actionBubbleInfoRef` so the
   * inline YES/NO handler can look it up on click. No-op when the
   * queue is empty — that's how the chain drains. Called from the
   * reviewing-fetch landing AND from `handleFollowUpReply` /
   * `handleSnippetLabel`'s EF-4 fallback path.
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

  const appendBridge = useCallback(() => {
    const idx = bridgeIndexRef.current % BRIDGES.length;
    bridgeIndexRef.current += 1;
    for (const b of botBubblesFromText(BRIDGES[idx])) appendBubble(b);
  }, [appendBubble]);

  /* ---------------------------------------------------------------------- */
  /*  Reviewing transition — inlined ChatReview fetch + emit                */
  /*                                                                          */
  /*  When the polling effect promotes phase to "reviewing", THIS effect    */
  /*  fetches the published snippets + Calm-Anchor trinity once, then       */
  /*  appends each snippet (as a snippet bubble + pending action bubble)    */
  /*  to the SAME bubbles array the user was already reading their         */
  /*  pending-greeting / welcome bubbles from. No component swap; the      */
  /*  thread stays continuous. Idempotent guard via a ref so an effect     */
  /*  re-fire doesn't double-append.                                       */
  /* ---------------------------------------------------------------------- */
  const reviewLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "reviewing" || !activeSessionId) return;
    if (reviewLoadedRef.current === activeSessionId) return;
    reviewLoadedRef.current = activeSessionId;

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/results/${encodeURIComponent(activeSessionId)}/snippets`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        if (!res.ok) {
          for (const b of botBubblesFromText(
            "Couldn't load this session's snippets."
          )) {
            appendBubble(b);
          }
          return;
        }
        const data = (await res.json()) as {
          snippets?: Array<Parameters<typeof mapBackendSnippet>[0]>;
          charisma_profile?: {
            trinity?: { power?: number; warmth?: number; presence?: number };
          } | null;
        };
        if (cancelled) return;

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

        const snippets = Array.isArray(data.snippets) ? data.snippets : [];
        if (snippets.length === 0) {
          for (const b of botBubblesFromText(
            "No snippets came through for this session — your coach is still preparing your insights."
          )) {
            appendBubble(b);
          }
        } else {
          // Serial reveal: queue ALL snippets, reveal only #1. The
          // followup chain (label → /chat/snippet-followup → user
          // reply → bridge → revealNextSnippet) drains the queue.
          snippetQueueRef.current = snippets.map(mapBackendSnippet);
          revealNextSnippet();
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("reviewing fetch failed:", err);
        for (const b of botBubblesFromText(
          "Couldn't load this session's snippets."
        )) {
          appendBubble(b);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [phase, activeSessionId]);

  /* ---------------------------------------------------------------------- */
  /*  Snippet-label resolution                                               */
  /*                                                                          */
  /*  On YES/NO click inside an action_pending bubble, run the full per-     */
  /*  snippet chain:                                                          */
  /*                                                                          */
  /*    1. POST /api/v2/user/snippets/<id>/label                            */
  /*       (existing label store — keeps RLHF / training data intact).      */
  /*    2. REPLACE the action bubble with a right-anchored user-text echo   */
  /*       of the chosen option (labelText).                                */
  /*    3. APPEND a typing bubble.                                            */
  /*    4. POST /api/v2/chat/snippet-followup with the AGREEMENT bool       */
  /*       (see matrix "Pinned semantics" — `agreement = clickedLabel ===   */
  /*       snippetType`).                                                    */
  /*    5a. On 200 with non-empty followup_text:                            */
  /*        REPLACE the typing bubble with bubble-split followup_text and  */
  /*        setPendingFollowUp(true). The next QAInput submit routes to    */
  /*        handleFollowUpReply (matrix row LI-4c).                         */
  /*    5b. On 5xx or empty (matrix row EF-4): REPLACE the typing with    */
  /*        the static FOLLOWUP_FALLBACK, then bridge + revealNextSnippet —*/
  /*        the user must never get stuck on a per-snippet network error.  */
  /*                                                                          */
  /*  Bubble-id lookup comes from `actionBubbleInfoRef` — populated by     */
  /*  revealNextSnippet, deleted here after the user-text replace so a     */
  /*  stale duplicate click no-ops.                                         */
  /* ---------------------------------------------------------------------- */
  const handleSnippetLabel = useCallback(
    async (snippetId: string, value: "charisma" | "stress") => {
      const info = actionBubbleInfoRef.current.get(snippetId);
      if (!info) return;
      const { bubbleId, snippetType } = info;

      const isCharismaAgreement = snippetType === "charisma";
      const labelText =
        value === snippetType
          ? isCharismaAgreement
            ? "YES, this is Charisma"
            : "YES, this is Stress"
          : isCharismaAgreement
          ? "NO, this is Stress"
          : "NO, this is Charisma";
      // Translation rule pinned in PANEL-STATE-MATRIX.md: the bool
      // we send to /v2/chat/snippet-followup means "did the user
      // AGREE with the AI's classification?".
      const agreement = value === snippetType;

      // qaSubmitting locks the QAInput composer across the entire
      // chain (matrix row LI-4a/LI-4b "composer disabled while POST
      // in flight"). Reset in every terminal branch below.
      updateBubble(bubbleId, { submitting: true });
      setQaSubmitting(true);

      // Step 1 — existing label POST. If this fails we roll back the
      // submitting flag and bail; followup endpoint only fires on a
      // successful label commit.
      let labelOk = false;
      try {
        const res = await fetch(
          `/api/v2/user/snippets/${encodeURIComponent(snippetId)}/label`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_label: value }),
          }
        );
        labelOk = res.ok;
      } catch (err) {
        console.warn("label POST failed:", err);
      }
      if (!labelOk) {
        updateBubble(bubbleId, { submitting: false });
        setQaSubmitting(false);
        return;
      }

      // Step 2 — user-text echo of the clicked label.
      replaceBubble(bubbleId, { kind: "user_text", text: labelText });
      actionBubbleInfoRef.current.delete(snippetId);

      // Step 3 — typing bubble while the followup roundtrip is in flight.
      const typingId = appendBubble({ kind: "typing" });

      // Step 4 — POST /v2/chat/snippet-followup.
      let followup = "";
      try {
        const res = await fetch("/api/v2/chat/snippet-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snippet_id: snippetId,
            user_label: agreement,
          }),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            followup_text?: string;
          };
          if (typeof data.followup_text === "string") {
            followup = data.followup_text.trim();
          }
        }
      } catch (err) {
        console.warn("snippet-followup POST failed:", err);
      }

      if (followup) {
        // 5a — happy path. Replace typing with the followup text and
        // hand control to the user; their next composer submit will
        // route through handleFollowUpReply.
        replaceBubble(typingId, botBubblesFromText(followup));
        setPendingFollowUp(true);
        setQaSubmitting(false);
        return;
      }

      // 5b — EF-4 fallback. Skip directly to bridge + next reveal so
      // the user never blocks on a transient backend issue.
      replaceBubble(typingId, botBubblesFromText(FOLLOWUP_FALLBACK));
      appendBridge();
      revealNextSnippet();
      setQaSubmitting(false);
    },
    [updateBubble, replaceBubble, appendBubble, appendBridge, revealNextSnippet]
  );

  /**
   * Composer submit during the followup-shown window (matrix row
   * LI-4d). Routes the user's reply into the thread instead of
   * `/chat/query`: append the user_text + a bridge bubble + reveal
   * the next snippet (or, if the queue is empty, allow deriveToolbar
   * to flip to `practice_cta` automatically). Resets pendingFollowUp
   * so subsequent composer submits go back to /chat/query.
   */
  const handleFollowUpReply = useCallback(
    (reply: string) => {
      appendBubble({ kind: "user_text", text: reply });
      appendBridge();
      setPendingFollowUp(false);
      revealNextSnippet();
    },
    [appendBubble, appendBridge, revealNextSnippet]
  );

  /* ---------------------------------------------------------------------- */
  /*  Phase transition handlers                                             */
  /* ---------------------------------------------------------------------- */

  const handlePracticeStart = useCallback(() => {
    setPhase("roleplaying");
  }, []);

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
    async (question: string) => {
      if (qaSubmitting) return;
      // 1) optimistic user bubble, 2) typing placeholder that gets
      // 1:N replaced with the answer chunks on completion. Keeps the
      // thread auto-scrolled and avoids a separate floating indicator.
      appendBubble({ kind: "user_text", text: question });
      const typingId = appendBubble({ kind: "typing" });
      setQaSubmitting(true);
      try {
        const res = await fetch("/api/v2/chat/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            session_id: activeSessionId,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          answer?: string;
          error?: string;
          show_upload_ui?: boolean;
        };
        // Rule G — per-turn signal. Always read this off every
        // /chat/query response, even on errors, so the flag never
        // gets stuck on after a transient failure.
        setShowUploadUi(data.show_upload_ui === true);
        if (res.ok && data.answer) {
          // KB-sourced answer. Rule F clarifies: the Master-Doc
          // exemption is on COMPRESSION (backend must not shorten
          // grounded content to hit 75 chars), not on visual
          // segmentation. Long answers still get bubble-split at
          // natural boundaries for readability. The full text is
          // preserved end-to-end — splitAiBubbleText only inserts
          // chunk boundaries at sentence/clause breaks, never drops
          // a word.
          replaceBubble(typingId, botBubblesFromText(data.answer));
        } else {
          // Backend error envelope — this IS first-party AI copy, so
          // it follows the 75-char rule like every other bot bubble.
          const fallback =
            data.error ?? "Couldn't reach the coach. Try again in a moment.";
          replaceBubble(typingId, botBubblesFromText(fallback));
        }
      } catch {
        replaceBubble(
          typingId,
          botBubblesFromText("Couldn't reach the coach. Try again in a moment.")
        );
        // Network failure → the upload-intent signal is stale data
        // from the previous turn. Reset to false so the paperclip
        // doesn't keep dangling after a fetch error.
        setShowUploadUi(false);
      } finally {
        setQaSubmitting(false);
      }
    },
    [qaSubmitting, activeSessionId, appendBubble, replaceBubble]
  );

  /**
   * Single composer submit handler — routes the user's text to
   * either the followup-reply handler (during the LI-4c/LI-4d
   * window) or the default /chat/query. This is the only function
   * `QAInput`'s onSubmit prop binds to, so the surface-level
   * routing decision is centralised here and the matrix-tested
   * `pendingFollowUp` flag is the sole switch.
   */
  const handleComposerSubmit = useCallback(
    (text: string) => {
      if (pendingFollowUp) {
        handleFollowUpReply(text);
        return;
      }
      void handleQASend(text);
    },
    [pendingFollowUp, handleFollowUpReply, handleQASend]
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
            <ThreadView bubbles={bubbles} onActionSelect={handleSnippetLabel} />
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
                reviewLoadedForActiveSession:
                  reviewLoadedRef.current === activeSessionId,
                showUploadUi,
                pendingFollowUp,
              });
              switch (mode.kind) {
                case "none":
                  return null;
                case "practice_cta":
                  return (
                    <div className="shrink-0 px-4 pb-4 pt-2">
                      <Button
                        type="button"
                        size="lg"
                        onClick={handlePracticeStart}
                        className="w-full rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground hover:shadow-lg sm:mx-auto sm:flex sm:w-auto"
                      >
                        Start practice (2 min)
                      </Button>
                    </div>
                  );
                case "mic":
                  return (
                    <div className="flex shrink-0 justify-center pb-6">
                      <MicButton
                        onTranscript={handleComposerSubmit}
                        disabled={qaSubmitting || uploadingFile}
                      />
                    </div>
                  );
                case "upload":
                  return (
                    <div className="flex shrink-0 justify-center pb-6">
                      <UploadButton
                        onUploadFile={handleQAFileUpload}
                        uploading={uploadingFile}
                        disabled={qaSubmitting}
                      />
                    </div>
                  );
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
