"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import ChatInterview from "@/components/funnel/ChatInterview";
import {
  AcousticMetricsBubble,
  ActionBubble,
  DashboardBubble,
  QAInput,
  SnippetPlayerBubble,
  TextBubble,
  TypingBubble,
  type AcousticMetricsBubbleData,
  type DashboardBubbleData,
  type SnippetPlayerData,
} from "@/components/chat/RichBubbles";
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
/*  `threadMessages: ThreadMessage[]` array — same array, same renderer,    */
/*  whether the user is reading welcome bubbles, asking Q&A questions, or  */
/*  reviewing snippets. ChatReview has been deleted.                        */
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
/*                         threadMessages array as Q&A text                 */
/*    reviewing      — pure state marker; uses the same render path as     */
/*                     q_and_a. Transition target for the polling effect   */
/*                     so the parent knows to fetch + emit snippet bubbles. */
/*    roleplaying    — 120s practice ChatInterview, new session              */
/*    error          — rate-limit / funnel-disabled / fatal load failure    */
/* -------------------------------------------------------------------------- */

type Phase =
  | "loading"
  | "onboarding"
  | "compiling"
  | "metrics_ask"
  | "welcome_back"
  | "q_and_a"
  | "reviewing"
  | "roleplaying"
  | "error";

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
 * Unified thread-message shape — ONE array carries every non-
 * recording bubble (welcome bubbles, Q&A text from either side, KB
 * answers, dashboard, snippet players, pending YES/NO actions, the
 * user-text echo of a resolved action, and upload-status updates).
 * Reviewing-phase bubbles append to the SAME array the user was
 * already reading their welcome / Q&A bubbles from, so the chat
 * stays chronologically continuous without any component swap.
 *
 * Recording-flow bubbles (AI questions, user-audio) still live
 * inside <ChatInterview> for the recording phases — see the
 * architecture header above.
 */
type ThreadMessage =
  | { kind: "bot_text"; id: string; text: string }
  | { kind: "user_text"; id: string; text: string }
  | { kind: "dashboard"; id: string; data: DashboardBubbleData }
  | { kind: "snippet"; id: string; data: SnippetPlayerData }
  | {
      kind: "action_pending";
      id: string;
      /** Snippet whose label this action resolves — passed back to
       *  the parent's POST so the right row updates. */
      snippetId: string;
      /** Snippet type drives YES/NO copy + which value is the
       *  "agreement" branch. */
      snippetType: "charisma" | "stress";
      submitting: boolean;
    };

/** Greeting copy shown to a returning user whose session is still
 *  processing — keeps them in the active Q&A surface instead of a
 *  static waiting page. Per the "pending users in active chat" spec. */
const PENDING_GREETING =
  "Your charisma snippets haven't arrived yet, but we can talk! " +
  "Do you have any questions or would you like to know more about " +
  "the voice analysis?";

/**
 * Helper — fan one logical AI text out into N bot bubbles, each ≤75
 * chars (Rule F). KB-sourced /v2/chat/query answers still pass
 * through this — the Master-Doc exemption is on COMPRESSION (the
 * model must not shorten grounded content to hit 75 chars), not on
 * visual segmentation, so long answers still get bubble-split here.
 */
function botBubblesFromText(text: string, idPrefix: string): ThreadMessage[] {
  const chunks = splitAiBubbleText(text);
  return chunks.map((t, i) => ({
    kind: "bot_text" as const,
    id: chunks.length === 1 ? idPrefix : `${idPrefix}-${i}`,
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

  /* Q&A composer state ---------------------------------------------------- */
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
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
      setThreadMessages(botBubblesFromText(PENDING_GREETING, "pending"));
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
    setThreadMessages([
      ...botBubblesFromText(
        "Thanks, check your email in a few hours.",
        "welcome-1"
      ),
      ...botBubblesFromText(
        "Do you have any questions or would you like to know more about the voice analysis?",
        "welcome-2"
      ),
    ]);
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

  /* ---------------------------------------------------------------------- */
  /*  Reviewing transition — inlined ChatReview fetch + emit                */
  /*                                                                          */
  /*  When the polling effect promotes phase to "reviewing", THIS effect    */
  /*  fetches the published snippets + Calm-Anchor trinity once, then       */
  /*  appends each snippet (as a snippet bubble + pending action bubble)    */
  /*  to the SAME threadMessages array the user was already reading their  */
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
          setThreadMessages((prev) => [
            ...prev,
            ...botBubblesFromText(
              "Couldn't load this session's snippets.",
              `review-error-${Date.now()}`
            ),
          ]);
          return;
        }
        const data = (await res.json()) as {
          snippets?: Array<Parameters<typeof mapBackendSnippet>[0]>;
          charisma_profile?: {
            trinity?: { power?: number; warmth?: number; presence?: number };
          } | null;
        };
        if (cancelled) return;

        const additions: ThreadMessage[] = [];

        if (data.charisma_profile?.trinity) {
          additions.push({
            kind: "dashboard",
            id: `dashboard-${activeSessionId}`,
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
          additions.push(
            ...botBubblesFromText(
              "No snippets came through for this session — your coach is still preparing your insights.",
              `review-empty-${activeSessionId}`
            )
          );
        } else {
          for (const raw of snippets) {
            const snippet = mapBackendSnippet(raw);
            additions.push({
              kind: "snippet",
              id: `snippet-${snippet.id}`,
              data: snippet,
            });
            additions.push({
              kind: "action_pending",
              id: `action-${snippet.id}`,
              snippetId: snippet.id,
              snippetType: snippet.type,
              submitting: false,
            });
          }
        }

        setThreadMessages((prev) => [...prev, ...additions]);
      } catch (err) {
        if (cancelled) return;
        console.warn("reviewing fetch failed:", err);
        setThreadMessages((prev) => [
          ...prev,
          ...botBubblesFromText(
            "Couldn't load this session's snippets.",
            `review-error-${Date.now()}`
          ),
        ]);
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
  /*  On YES/NO click inside an action_pending bubble: POST the user label  */
  /*  to /api/v2/user/snippets/<id>/label, REPLACE the action bubble with   */
  /*  a right-anchored user-text echo of the chosen option, and leave the   */
  /*  snippet bubble above it intact so the thread reads chronologically.   */
  /* ---------------------------------------------------------------------- */
  const handleSnippetLabel = useCallback(
    async (snippetId: string, value: string, labelText: string) => {
      setThreadMessages((prev) =>
        prev.map((m) =>
          m.kind === "action_pending" && m.snippetId === snippetId
            ? { ...m, submitting: true }
            : m
        )
      );
      try {
        const res = await fetch(
          `/api/v2/user/snippets/${encodeURIComponent(snippetId)}/label`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_label: value }),
          }
        );
        if (!res.ok) {
          // Roll back submitting so user can retry.
          setThreadMessages((prev) =>
            prev.map((m) =>
              m.kind === "action_pending" && m.snippetId === snippetId
                ? { ...m, submitting: false }
                : m
            )
          );
          return;
        }
        // Success — swap the action bubble for a user-text echo.
        setThreadMessages((prev) =>
          prev.flatMap((m) =>
            m.kind === "action_pending" && m.snippetId === snippetId
              ? [
                  {
                    kind: "user_text" as const,
                    id: `user-label-${snippetId}`,
                    text: labelText,
                  },
                ]
              : [m]
          )
        );
      } catch (err) {
        console.warn("label POST failed:", err);
        setThreadMessages((prev) =>
          prev.map((m) =>
            m.kind === "action_pending" && m.snippetId === snippetId
              ? { ...m, submitting: false }
              : m
          )
        );
      }
    },
    []
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
      const userMsg: ThreadMessage = {
        kind: "user_text",
        id: `u-${Date.now()}`,
        text: question,
      };
      setThreadMessages((prev) => [...prev, userMsg]);
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
          setThreadMessages((prev) => [
            ...prev,
            ...botBubblesFromText(data.answer!, `b-${Date.now()}`),
          ]);
        } else {
          // Backend error envelope — this IS first-party AI copy, so
          // it follows the 75-char rule like every other bot bubble.
          const fallback =
            data.error ?? "Couldn't reach the coach. Try again in a moment.";
          setThreadMessages((prev) => [
            ...prev,
            ...botBubblesFromText(fallback, `b-${Date.now()}`),
          ]);
        }
      } catch {
        setThreadMessages((prev) => [
          ...prev,
          ...botBubblesFromText(
            "Couldn't reach the coach. Try again in a moment.",
            `b-${Date.now()}`
          ),
        ]);
        // Network failure → the upload-intent signal is stale data
        // from the previous turn. Reset to false so the paperclip
        // doesn't keep dangling after a fetch error.
        setShowUploadUi(false);
      } finally {
        setQaSubmitting(false);
      }
    },
    [qaSubmitting, activeSessionId]
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
        setThreadMessages((prev) => [
          ...prev,
          ...botBubblesFromText(
            "Sign in to upload files — pre-recorded uploads need an account.",
            `b-${Date.now()}`
          ),
        ]);
        return;
      }
      setUploadingFile(true);
      try {
        const result = await uploadUserFile(file, {
          sessionId: activeSessionId,
          authToken: token,
        });
        setThreadMessages((prev) => [
          ...prev,
          ...botBubblesFromText(
            `File “${result.filename}” uploaded — your coach will review it.`,
            `b-${Date.now()}`
          ),
        ]);
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
        setThreadMessages((prev) => [
          ...prev,
          ...botBubblesFromText(
            `Couldn't upload “${file.name}” — ${message}`,
            `b-${Date.now()}`
          ),
        ]);
      } finally {
        setUploadingFile(false);
        // Per Rule G, the upload-intent signal is per-turn — hide
        // the paperclip again until the next intent-signalled turn.
        setShowUploadUi(false);
      }
    },
    [activeSessionId, qaSubmitting, uploadingFile]
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
            welcome_back / q_and_a / reviewing all share this one
            render path against the same threadMessages array. The
            reviewing fetch effect above appends snippet + action
            bubbles to the SAME array the user has been reading
            their pending-greeting / welcome / Q&A bubbles from.
            Strict bottom toolbar state machine drives the bottom
            slot (see derivedBottomMode below). */}
        {(phase === "welcome_back" ||
          phase === "q_and_a" ||
          phase === "reviewing") && (
          <div className="flex flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto py-6">
              {threadMessages.map((m) => {
                switch (m.kind) {
                  case "bot_text":
                    return <TextBubble key={m.id}>{m.text}</TextBubble>;
                  case "user_text":
                    return <UserChatBubble key={m.id} text={m.text} />;
                  case "dashboard":
                    return <DashboardBubble key={m.id} data={m.data} />;
                  case "snippet":
                    return (
                      <SnippetPlayerBubble key={m.id} snippet={m.data} />
                    );
                  case "action_pending": {
                    const isCharismaAgreement = m.snippetType === "charisma";
                    return (
                      <ActionBubble
                        key={m.id}
                        prompt="Do you agree with this insight?"
                        options={[
                          {
                            value: m.snippetType,
                            label: isCharismaAgreement
                              ? "YES, this is Charisma"
                              : "YES, this is Stress",
                          },
                          {
                            value: isCharismaAgreement ? "stress" : "charisma",
                            label: isCharismaAgreement
                              ? "NO, this is Stress"
                              : "NO, this is Charisma",
                            variant: "outline",
                          },
                        ]}
                        selected={null}
                        submitting={m.submitting}
                        onSelect={(value) => {
                          const labelText =
                            value === m.snippetType
                              ? isCharismaAgreement
                                ? "YES, this is Charisma"
                                : "YES, this is Stress"
                              : isCharismaAgreement
                              ? "NO, this is Stress"
                              : "NO, this is Charisma";
                          void handleSnippetLabel(
                            m.snippetId,
                            value,
                            labelText
                          );
                        }}
                      />
                    );
                  }
                }
              })}
              {qaSubmitting && <TypingBubble />}
            </div>
            {/* Strict bottom toolbar state machine — single slot,
                mutually exclusive. Order of precedence:
                  Override A1 — Practice CTA (all snippets resolved,
                    reviewing phase ready for handoff)
                  Override B  — Upload icon (show_upload_ui)
                  Default     — Q&A text composer (default for the
                    non-recording surface). Note: spec calls for
                    the mic to be the global default, but until
                    voice-Q&A backend support exists we keep the
                    QAInput as the de-facto default for this
                    surface so the user can ask questions today.
                The welcome_back phase shows no bottom — those two
                bubbles are read-only for ~400ms before the
                q_and_a transition mounts the composer. */}
            {(() => {
              if (phase === "welcome_back") return null;

              const pendingActions = threadMessages.filter(
                (m) => m.kind === "action_pending"
              );
              const reviewReadyForPractice =
                phase === "reviewing" &&
                reviewLoadedRef.current === activeSessionId &&
                pendingActions.length === 0 &&
                threadMessages.some((m) => m.kind === "snippet");

              if (reviewReadyForPractice) {
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
              }

              // Default (Q&A composer). Native <input type="file">
              // paperclip lives inside QAInput, gated on
              // showUploadUi per Rule G. While ActionBubbles are
              // pending the composer stays mounted but the user's
              // attention is on the inline YES/NO; that's fine —
              // the composer is the only "neutral" bottom mode the
              // user has on this surface.
              return (
                <div className="flex shrink-0 justify-center pb-4">
                  <QAInput
                    onSubmit={handleQASend}
                    submitting={qaSubmitting}
                    onUploadFile={
                      showUploadUi ? handleQAFileUpload : undefined
                    }
                    uploading={uploadingFile}
                  />
                </div>
              );
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
 * Lightweight right-aligned user bubble. Kept inline rather than in
 * RichBubbles.tsx because it's specific to the Q&A composer's
 * single-line text shape — no audio, no animation delays.
 */
function UserChatBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end animate-fade-in-up">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-chat-bubble-user px-4 py-2.5 text-sm leading-relaxed text-chat-bubble-user-foreground shadow-sm">
        {text}
      </div>
    </div>
  );
}

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
