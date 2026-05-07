"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import AfterwardsVideo from "@/components/funnel/AfterwardsVideo";
import CuriosityGate from "@/components/funnel/CuriosityGate";
import ChatInterview from "@/components/funnel/ChatInterview";
import SectionCard from "@/components/admin/SectionCard";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { createClient } from "@/lib/supabase/client";
import { setPendingSessionId } from "@/lib/funnel/pendingSession";

/**
 * Curiosity Gate state machine (multi-turn interview version).
 *
 * idle            — explainer video + chat interview begins (first question loaded).
 * interviewing    — multi-turn Q&A in progress. User records answers,
 *                   new questions appear until aggregate duration >= 30s.
 * processing      — brief anticipation hold before gate (optional, kept short).
 * curiosity_gate  — post-interview flow with video + signup form (guest) or
 *                   waiting message (logged in). On signup, claims the session.
 * done            — shows the afterwards video. User can navigate away.
 * rate_limited    — 429 from /upload (per-IP cap exceeded).
 * disabled        — 503 GUEST_FUNNEL_DISABLED (feature flag off in Railway).
 */
type Status =
  | "idle"
  | "interviewing"
  | "processing"
  | "curiosity_gate"
  | "done"
  | "rate_limited"
  | "disabled";

const MIN_PROCESSING_MS = 2500;

const PROCESSING_LABELS = [
  "Analyzing stress patterns…",
  "Mapping charisma markers…",
  "Detecting filler-word density…",
  "Finalizing your report…",
];

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

/**
 * 1-minute explainer video, lazily fetched. The endpoint can return no URL or
 * fail entirely — in either case we render nothing so the recorder CTA is
 * never blocked behind a missing video.
 */
function ExplainerVideo() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/funnel/afterwards-video")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const v = data?.video_url;
        if (typeof v === "string" && v) setUrl(v);
      })
      .catch(() => {
        /* silent — explainer is optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!url) return null;
  return (
    <video
      src={url}
      className="aspect-video w-full rounded-xl bg-black shadow-sm"
      controls
      playsInline
    />
  );
}

function ProcessingScreen() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setIdx((i) => (i + 1) % PROCESSING_LABELS.length),
      1500
    );
    return () => clearInterval(t);
  }, []);
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-6"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      <p className="text-base font-medium text-foreground">
        {PROCESSING_LABELS[idx]}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

export default function HeroRecorder() {
  const [status, setStatus] = useState<Status>("idle");
  const [authState, setAuthState] = useState<
    "unknown" | "anonymous" | "signed_in"
  >("unknown");

  // Remember the guest_session_id returned by the interview upload so the
  // post-auth claim call can pass it explicitly.
  const guestSessionIdRef = useRef<string | null>(null);

  // Detect existing auth (rare on this funnel, but possible if the user
  // returns mid-flow). We don't redirect them — they can still record again.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return;
        setAuthState(data.user ? "signed_in" : "anonymous");
      })
      .catch(() => {
        if (!cancelled) setAuthState("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Handler called when guest signs up/logs in via CuriosityGate.
   * The claim is handled by CuriosityGate component itself, so we just
   * leave the state as-is (CuriosityGate shows waiting card).
   */
  const handleCuriosityGateSuccess = useCallback(() => {
    // No-op: CuriosityGate handles its own post-claim UI
    // (shows "Homework submitted!" waiting card)
  }, []);

  /**
   * Called by ChatInterview when aggregate recording time >= 30s.
   * Transitions through a brief processing screen to the gate.
   */
  const handleThresholdReached = useCallback(
    async (guestSessionId: string) => {
      guestSessionIdRef.current = guestSessionId;
      // Stash the anonymous session id in localStorage so OAuth round-trips
      // (LinkedIn etc.) can survive the redirect and the post-auth hook
      // can claim it for the newly-authenticated user.
      setPendingSessionId(guestSessionId);
      setStatus("processing");
      // Brief anticipation hold so the transition isn't jarring
      await new Promise((r) => setTimeout(r, MIN_PROCESSING_MS));
      setStatus("curiosity_gate");
    },
    []
  );

  /**
   * Error handler from ChatInterview (rate limit, funnel disabled).
   */
  const handleInterviewError = useCallback(
    (code: string) => {
      if (code === "RATE_LIMITED") {
        setStatus("rate_limited");
      } else if (code === "GUEST_FUNNEL_DISABLED") {
        setStatus("disabled");
      }
    },
    []
  );

  // Auto-start the interview as soon as auth state is known
  useEffect(() => {
    if (authState !== "unknown" && status === "idle") {
      setStatus("interviewing");
    }
  }, [authState, status]);

  // Viewport-locked: page fits the device exactly. Inner regions own their
  // own scrolling (chat thread). The body never scrolls. The unified
  // DashboardHeader is mounted up top regardless of auth state — it adapts
  // its right-side content (Log in / Sign up vs credits + menu) on its own.
  return (
    <main className="willab-chat flex h-full flex-col overflow-hidden bg-background">
      <div className="shrink-0">
        <DashboardHeader />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-4 py-8">
        {status === "rate_limited" ? (
          <SectionCard title="You've tried a few times">
            <p className="text-sm text-muted-foreground">
              Give it 15 minutes and come back. We rate-limit to keep it fast
              for everyone.
            </p>
          </SectionCard>
        ) : status === "disabled" ? (
          <SectionCard title="Trial temporarily unavailable">
            <p className="text-sm text-muted-foreground">
              We&apos;ve paused the voice trial briefly. Please check back shortly.
            </p>
          </SectionCard>
        ) : status === "curiosity_gate" ? (
          <CuriosityGate
            isGuest={authState === "anonymous"}
            guestSessionId={guestSessionIdRef.current}
            onSuccess={handleCuriosityGateSuccess}
          />
        ) : status === "done" ? (
          <AfterwardsVideo />
        ) : status === "processing" ? (
          <ProcessingScreen />
        ) : status === "interviewing" ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Optional explainer video sits above the chat (shrink-0 so the
                thread below gets the rest of the height). The Log-in CTA
                that used to be inline here is now in the global header. */}
            <div className="shrink-0 space-y-4">
              <ExplainerVideo />
            </div>

            {/* Multi-turn interview chat — owns its own internal scroll.
                isGuest surfaces the GDPR mic disclaimer for the first
                recording when the user hasn't signed up yet. */}
            <ChatInterview
              onThresholdReached={handleThresholdReached}
              onError={handleInterviewError}
              isGuest={authState === "anonymous"}
            />
          </div>
        ) : (
          /* idle: waiting for auth state */
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </main>
  );
}
