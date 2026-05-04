"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import AfterwardsVideo from "@/components/funnel/AfterwardsVideo";
import CuriosityGate from "@/components/funnel/CuriosityGate";
import ChatBubble from "@/components/funnel/ChatBubble";
import VoiceRecordButton from "@/components/funnel/VoiceRecordButton";
import SectionCard from "@/components/admin/SectionCard";
import WillabLogo from "@/components/WillabLogo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  GuestUploadFailure,
  uploadGuestRecording,
} from "@/lib/api/public-client";

/**
 * Curiosity Gate state machine.
 *
 * idle            — explainer video + Start CTA. AudioRecorder is mounted but
 *                   hasn't been started by the user yet.
 * recording       — user is mid-recording. Explainer video hidden.
 * processing      — upload is in flight + an anticipation animation runs for at
 *                   least MIN_PROCESSING_MS so the UI doesn't snap straight to
 *                   the gate even on a fast network.
 * curiosity_gate  — post-recording flow with video + signup form (guest) or
 *                   waiting message (logged in). On signup, claims the session.
 * done            — shows the afterwards video. User can navigate away or re-record.
 * rate_limited    — 429 from /upload (per-IP cap exceeded).
 * disabled        — 503 GUEST_FUNNEL_DISABLED (feature flag off in Railway).
 */
type Status =
  | "idle"
  | "recording"
  | "processing"
  | "curiosity_gate"
  | "done"
  | "rate_limited"
  | "disabled";

const FUNNEL_PROMPT =
  "Tell us, in your own words: do you think you're a good communicator? Why?";
const MIN_DURATION_SECONDS = 15;
const MIN_PROCESSING_MS = 3500;

const PROCESSING_LABELS = [
  "Analyzing stress patterns…",
  "Mapping charisma markers…",
  "Detecting filler-word density…",
  "Finalizing your report…",
];

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function AnonymousTopBar() {
  return (
    <div className="flex w-full items-center justify-between">
      <Link href="/" aria-label="Willab home">
        <WillabLogo size="md" />
      </Link>
      <Link href="/login">
        <Button variant="outline" size="sm">
          Log in
        </Button>
      </Link>
    </div>
  );
}

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authState, setAuthState] = useState<
    "unknown" | "anonymous" | "signed_in"
  >("unknown");

  // Remember the guest_session_id returned by /upload so the post-auth claim
  // call can pass it explicitly. (The backend also reads the cookie, but the
  // explicit field defends against same-tab signup races where the cookie
  // hasn't yet been re-attached to the new session.)
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
   * transition to "done" state.
   */
  const handleCuriosityGateSuccess = useCallback(() => {
    // No-op: CuriosityGate handles its own post-claim UI
    // (shows "Homework submitted!" waiting card)
  }, []);

  const handleRecordingStart = useCallback(() => {
    setStatus("recording");
  }, []);

  const handleRecordingComplete = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      setStatus("processing");
      setErrorMessage(null);
      const startedAt = Date.now();
      try {
        const { guest_session_id } = await uploadGuestRecording(
          blob,
          durationSeconds
        );
        guestSessionIdRef.current = guest_session_id;

        // Anticipation hold: keep the processing screen up for at least
        // MIN_PROCESSING_MS so the rotating labels actually rotate even when
        // the upload is sub-second. Pure UX, no analysis happens here.
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, MIN_PROCESSING_MS - elapsed);
        if (remaining > 0) {
          await new Promise((r) => setTimeout(r, remaining));
        }
        setStatus("curiosity_gate");
      } catch (err) {
        if (err instanceof GuestUploadFailure) {
          if (err.status === 429 || err.code === "RATE_LIMITED") {
            setStatus("rate_limited");
            return;
          }
          if (err.status === 503 || err.code === "GUEST_FUNNEL_DISABLED") {
            setStatus("disabled");
            return;
          }
          setErrorMessage(err.message);
        } else {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : "Upload failed. Please try again."
          );
        }
        setStatus("idle");
      }
    },
    []
  );

  return (
    <main className="willab-chat min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
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
              We've paused the voice trial briefly. Please check back shortly.
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
        ) : (
          // idle + recording share the same mount. The visual swap moves the
          // sniper UI out and renders the chat layout instead. All upload +
          // routing logic still lives in handleRecordingComplete below.
          <div className="space-y-6">
            {authState === "anonymous" && <AnonymousTopBar />}
            {status === "idle" && <ExplainerVideo />}
            <ChatBubble type="bot" content={FUNNEL_PROMPT} />
            <div className="flex flex-col items-center gap-2 pt-2">
              <VoiceRecordButton
                onStart={handleRecordingStart}
                onSend={handleRecordingComplete}
                minDurationSeconds={MIN_DURATION_SECONDS}
              />
              {status === "idle" && (
                <p className="text-xs text-muted-foreground">
                  Tap the mic to begin. Aim for at least {MIN_DURATION_SECONDS}{" "}
                  seconds.
                </p>
              )}
            </div>
            {errorMessage && status === "idle" && (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {errorMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
