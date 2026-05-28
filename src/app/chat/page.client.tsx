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
} from "@/components/chat/RichBubbles";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { BottomSlot } from "@/components/chat/BottomSlot";
import { SignupCta, YesNoPills } from "@/components/chat/slots";
import { RecordingReadyPanel } from "@/components/chat/RecordingReadyPanel";
import { snippetLabelPrompt } from "@/lib/chat/snippetLabel";
import ThreadView from "@/components/chat/thread/ThreadView";
import { deriveToolbar } from "@/components/chat/thread/toolbar";
import { useThread } from "@/components/chat/thread/useThread";
import type { BubbleInput, Phase } from "@/components/chat/thread/types";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/lib/api/auth-client";
import { splitAiBubbleText } from "@/lib/chat/bubbleSplit";
import { botBubblesFromText } from "@/lib/chat/botBubbles";
import { useRecordingHandoff } from "@/components/chat/hooks/useRecordingHandoff";
import { useQAComposer } from "@/components/chat/hooks/useQAComposer";
import { useChatPhase } from "@/components/chat/hooks/useChatPhase";
import { useReviewingFetch } from "@/components/chat/hooks/useReviewingFetch";
import { useSnippetLabelingChain } from "@/components/chat/hooks/useSnippetLabelingChain";
import { setPendingSessionId } from "@/lib/funnel/pendingSession";
import { setPostOnboardingWelcome } from "@/lib/funnel/postOnboardingWelcome";

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

  // Phase state machine + auth bootstrap + realtime subscription.
  // See `useChatPhase` for the full spec.
  const {
    phase,
    setPhase,
    errorMsg,
    setErrorMsg,
    activeSessionId,
    setActiveSessionId,
    userId,
    refetchToken,
    guard,
  } = useChatPhase({ sessionId, appendBubble, clearBubbles });

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
  /** Map of snippetId → action-bubble info ({id, snippetType}), so the
   *  inline ThreadView onActionSelect handler can route a click into
   *  the existing `submitting` / replace-with-user-text-echo lifecycle
   *  without scanning the bubbles array. snippetType is mirrored here
   *  because the action_pending bubble itself is removed on replace,
   *  but the label-text echo computation needs it. */
  const actionBubbleInfoRef = useRef<
    Map<string, { bubbleId: string; snippetType: "charisma" | "stress" }>
  >(new Map());
  // Q&A composer surface — owns qaSubmitting, the Rule G per-turn
  // paperclip/record flags, and the file-upload + composer-submit
  // handlers. See `useQAComposer` for the full spec.
  const {
    qaSubmitting,
    setQaSubmitting,
    showUploadUi,
    showRecordUi,
    uploadingFile,
    handleComposerSubmit,
    handleQAFileUpload,
  } = useQAComposer({ activeSessionId, appendBubble, replaceBubble });

  // Post-labeling recording handoff — owns the big-mic state, the
  // post-upload idle window, and the two RecordingReadyPanel
  // callbacks. See `useRecordingHandoff` for the full spec.
  const {
    recordingReadyForSnippetId,
    setRecordingReadyForSnippetId,
    awaitingAdminReview,
    setAwaitingAdminReview,
    onRecordingCaptured,
    onUploadComplete,
  } = useRecordingHandoff({ appendBubble });

  // Snippet labeling closer-out chain — Yes/No → label → followup →
  // thanks → intro → recording_ready. Owns the closed-out Set
  // (localStorage-persisted, exposed as a ref so the reviewing-fetch
  // hook can skip already-closed snippets). See
  // `useSnippetLabelingChain` for the full spec.
  const { handleSnippetLabel, closedOutSnippetIdsRef } =
    useSnippetLabelingChain({
      userId,
      actionBubbleInfoRef,
      appendBubble,
      updateBubble,
      replaceBubble,
      setQaSubmitting,
      setRecordingReadyForSnippetId,
      setAwaitingAdminReview,
    });

  // Reviewing surface — status polling (q_and_a → reviewing flip)
  // + snippet fetch + 30s incremental refresh. Pure side-effect
  // hook; see `useReviewingFetch` for the full spec.
  useReviewingFetch({
    phase,
    setPhase,
    activeSessionId,
    refetchToken,
    bubbles,
    appendBubble,
    actionBubbleInfoRef,
    closedOutSnippetIdsRef,
  });

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
  }, [phase, setPhase]);

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
                <div className="flex w-full max-w-sm flex-col items-center gap-2">
                  <SignupCta
                    onClick={handleSignUpClick}
                    label="Sign up for your full analysis"
                  />
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
                        onRecordingCaptured={onRecordingCaptured}
                        onUploadComplete={onUploadComplete}
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
