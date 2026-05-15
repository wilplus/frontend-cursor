"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Lottie from "lottie-react";
import ChatInterview from "@/components/funnel/ChatInterview";
import ChatReview from "@/components/chat/ChatReview";
import AfterwardsVideo from "@/components/funnel/AfterwardsVideo";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { useSessionRouteGuard } from "@/lib/session/useSessionRouteGuard";

/* -------------------------------------------------------------------------- */
/*  Phase state machine                                                       */
/*                                                                            */
/*  The /chat surface is now the user's ENTIRE post-onboarding home —        */
/*  there's no /results page anymore. The phase controls which sub-surface   */
/*  renders inside the shared chrome:                                        */
/*                                                                            */
/*    loading      — initial auth + state probe in flight                    */
/*    onboarding   — cold-start chat (30s aggregate cap). No session yet.    */
/*    waiting      — session is processing; ProcessingState + polling        */
/*                   /api/results/[id]/status for the flip to "completed".   */
/*    reviewing    — published snippets streamed as rich chat bubbles        */
/*                   (DashboardBubble, MirrorBubble, SnippetPlayerBubble +   */
/*                   ActionBubble). User confirms/corrects each label.       */
/*    roleplaying  — new session cut after review handoff (120s cap).        */
/*    complete     — post-finalize Lottie "preparing your insights" hold     */
/*                   before routing back to /chat?session=<new id>.          */
/*    error        — rate-limit / funnel-disabled / load failure.            */
/* -------------------------------------------------------------------------- */

type Phase =
  | "loading"
  | "onboarding"
  | "waiting"
  | "reviewing"
  | "roleplaying"
  | "complete"
  | "error";

const VOICE_LOADING_PHRASES = [
  "Analyzing your charisma markers…",
  "Mapping stress patterns…",
  "Detecting filler-word density…",
  "Tuning into your vocal energy…",
  "Finalizing your insights…",
] as const;

const POLL_INTERVAL_MS = 5_000;
const ROLEPLAY_CAP_SECONDS = 120;
const ONBOARDING_CAP_SECONDS = 30;

function shufflePhrases(phrases: readonly string[]): string[] {
  const shuffled = [...phrases];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/* -------------------------------------------------------------------------- */
/*  Sub-screens                                                               */
/* -------------------------------------------------------------------------- */

function WaitingScreen() {
  // Post-login waiting screen plays the founder/onboarding video
  // (same one previously gated behind HeroRecorder's "done" status)
  // so the user has something engaging to watch while the admin
  // reviews their session. The Lottie + rotating-phrase loading
  // animation was tested with users (Marcin et al.) and read as
  // "empty waiting" — too clinical, no reward for finishing the
  // recording. The video carries the brand voice forward and keeps
  // them on the page until the polling loop flips status to
  // "completed".
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 text-center animate-fade-in-up">
      <p className="text-sm font-medium text-foreground">
        Your coach is preparing your insights.
      </p>
      <div className="w-full">
        <AfterwardsVideo />
      </div>
      <p className="mx-auto max-w-sm text-[11px] leading-relaxed text-muted-foreground/80">
        Usually a few minutes. You can leave this open, or we&apos;ll email you
        when it&apos;s ready.
      </p>
    </div>
  );
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

  /**
   * Initial phase is decided by the URL:
   *   - `?session=<id>` present → "loading" (then waiting or reviewing
   *     based on the status probe).
   *   - No param → "loading" then "onboarding" once guard passes.
   *
   * The infinite-loop guard handles the "user has another session
   * in flight" case for the param-less route: it redirects to
   * `/chat?session=<theirSessionId>` and the rest of the flow takes
   * over on the redirected mount.
   */
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** Snapshot of `sessionId` we're actively reviewing/roleplaying — held
   *  in state so the roleplay handoff can keep referencing the original
   *  session id without the URL changing. */
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    sessionId
  );
  /** Captured when a chat finalizes — drives the post-finalize redirect
   *  back to /chat?session=<new-id> so the loop repeats. */
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(
    null
  );

  // Loop guard. ONLY runs when there's no `?session=` in the URL:
  // with a session id, we're either waiting or reviewing on purpose and
  // the guard shouldn't bounce us elsewhere. Without a session id, the
  // guard checks whether the user has an in-flight or published session
  // and redirects them to `/chat?session=<id>` to enter the loop.
  const guard = useSessionRouteGuard({ enabled: !sessionId });

  /* ---------------------------------------------------------------------- */
  /*  Loading → onboarding when no session, → waiting when session exists.  */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (guard.checking || guard.redirecting) return;
    if (sessionId) {
      setPhase("waiting");
    } else {
      setPhase("onboarding");
    }
  }, [sessionId, guard.checking, guard.redirecting]);

  /* ---------------------------------------------------------------------- */
  /*  Polling: while phase === "waiting", probe status until "completed".   */
  /* ---------------------------------------------------------------------- */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (phase !== "waiting" || !activeSessionId) return;

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
        // Silent — the interval will retry.
      }
    };

    // Fire immediately so the user doesn't wait POLL_INTERVAL_MS on
    // an already-completed session.
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
  /*  Phase transitions                                                     */
  /* ---------------------------------------------------------------------- */

  const handlePracticeStart = useCallback(() => {
    // Review → roleplay handoff. The next ChatInterview mount cuts a
    // brand new backend session via the existing upload-answer flow
    // (no guestSessionId on first POST = backend mints a new one).
    setPhase("roleplaying");
  }, []);

  const handleChatComplete = useCallback((guestSessionId: string) => {
    // Roleplay (or onboarding) wrapped up. Capture the session id so
    // the "complete" Lottie screen can deep-link back into the loop:
    //   /chat?session=<new-id> → waiting → reviewing → roleplay → …
    setCompletedSessionId(guestSessionId);
    setPhase("complete");
  }, []);

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
  /*  Post-complete redirect: route back into the loop with the new id.    */
  /* ---------------------------------------------------------------------- */
  const [completePhraseIdx, setCompletePhraseIdx] = useState(0);
  const [completePhrases] = useState<string[]>(() =>
    shufflePhrases(VOICE_LOADING_PHRASES)
  );
  const [completeLottie, setCompleteLottie] = useState<object | null>(null);
  useEffect(() => {
    if (phase !== "complete") return;
    let cancelled = false;
    fetch("/animations/loading.json")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCompleteLottie(data);
      })
      .catch(() => {});
    const phraseId = setInterval(() => {
      setCompletePhraseIdx((i) => (i + 1) % completePhrases.length);
    }, 1800);
    const redirectId = setTimeout(() => {
      const target = completedSessionId
        ? `/chat?session=${encodeURIComponent(completedSessionId)}`
        : "/chat";
      router.push(target);
    }, 4500);
    return () => {
      cancelled = true;
      clearInterval(phraseId);
      clearTimeout(redirectId);
    };
  }, [phase, completedSessionId, completePhrases, router]);

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

        {phase === "onboarding" && (
          <ChatInterview
            onThresholdReached={handleChatComplete}
            onError={handleChatError}
            aggregateThresholdSeconds={ONBOARDING_CAP_SECONDS}
          />
        )}

        {phase === "waiting" && <WaitingScreen />}

        {phase === "reviewing" && activeSessionId && (
          <ChatReview
            sessionId={activeSessionId}
            onPracticeStart={handlePracticeStart}
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

        {phase === "complete" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center animate-fade-in-up">
            <div className="h-24 w-24 opacity-80">
              {completeLottie ? (
                <Lottie animationData={completeLottie} loop />
              ) : (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground min-h-[1.25rem] transition-opacity duration-300">
              {completePhrases[completePhraseIdx]}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
