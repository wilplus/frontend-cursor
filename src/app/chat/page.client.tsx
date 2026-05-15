"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
  | "error";

const POLL_INTERVAL_MS = 5_000;
const ROLEPLAY_CAP_SECONDS = 120;
const ONBOARDING_CAP_SECONDS = 30;

/* -------------------------------------------------------------------------- */
/*  Sub-screens                                                               */
/* -------------------------------------------------------------------------- */

function WaitingScreen() {
  // Single source of truth for the post-record / post-publish wait.
  // Centres the founder/onboarding video and pairs it with explicit
  // "you can close this page" copy so the user knows they're not
  // chained to the tab while a human coach reviews their session.
  // Polling for the processing→completed flip continues in the
  // background (see useEffect in ChatPageClient); the moment it
  // flips, phase advances to "reviewing" and this surface unmounts.
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-5 px-4 py-6 text-center animate-fade-in-up">
      <p className="font-heading text-xl leading-tight text-foreground sm:text-2xl">
        Our human coach is analyzing your acoustic profile.
      </p>
      <div className="w-full">
        <AfterwardsVideo />
      </div>
      <div className="mx-auto max-w-md space-y-2">
        <p className="text-sm font-semibold leading-relaxed text-foreground">
          You can close this page —{" "}
          <span className="text-primary">
            we&apos;ll email you the moment your charisma snippets and feedback
            are ready.
          </span>
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Typical turnaround is a few minutes. No need to keep the tab open.
        </p>
      </div>
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

  const handleChatComplete = useCallback(
    (guestSessionId: string) => {
      // Onboarding / roleplay finalize wrapped. Redirect IMMEDIATELY
      // into the loop's waiting surface — no intermediate Lottie hold.
      // The video-driven WaitingScreen on /chat?session=<id> is now
      // the single source of truth for the post-record wait state;
      // sticking a 4.5s plain Lottie hold between the farewell and the
      // video just re-introduced the "empty loading" feel we just
      // removed. The user already saw the bot's farewell bubble during
      // the 3-second pause inside ChatInterview's endSession(), so the
      // visual context is already set.
      const target = guestSessionId
        ? `/chat?session=${encodeURIComponent(guestSessionId)}`
        : "/chat";
      router.push(target);
    },
    [router]
  );

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
      </div>
    </main>
  );
}
