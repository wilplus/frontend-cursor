"use client";

import { Suspense, useCallback, useState } from "react";
import AudioRecorder from "@/components/recording/AudioRecorder";
import AuthGate from "@/components/funnel/AuthGate";
import FunnelReturnToast from "@/components/funnel/FunnelReturnToast";
import SectionCard from "@/components/admin/SectionCard";
import {
  GuestUploadFailure,
  uploadGuestRecording,
} from "@/lib/api/public-client";

type Phase = "idle" | "uploading" | "uploaded" | "rate_limited" | "disabled";

const FUNNEL_PROMPT =
  "Tell us, in your own words: do you think you're a good communicator? Why?";
const MIN_DURATION_SECONDS = 15;

export default function ShakyVoiceFunnelPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRecordingComplete = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      setPhase("uploading");
      setErrorMessage(null);
      try {
        await uploadGuestRecording(blob, durationSeconds);
        setPhase("uploaded");
      } catch (err) {
        if (err instanceof GuestUploadFailure) {
          if (err.status === 429 || err.code === "RATE_LIMITED") {
            setPhase("rate_limited");
            return;
          }
          if (err.status === 503 || err.code === "GUEST_FUNNEL_DISABLED") {
            setPhase("disabled");
            return;
          }
          setErrorMessage(err.message);
        } else {
          setErrorMessage(
            err instanceof Error ? err.message : "Upload failed. Please try again."
          );
        }
        setPhase("idle");
      }
    },
    []
  );

  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <FunnelReturnToast />
      </Suspense>
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        {phase === "rate_limited" ? (
          <SectionCard title="You've tried a few times">
            <p className="text-sm text-muted-foreground">
              Give it 15 minutes and come back. We rate-limit to keep it fast for everyone.
            </p>
          </SectionCard>
        ) : phase === "disabled" ? (
          <SectionCard title="Trial temporarily unavailable">
            <p className="text-sm text-muted-foreground">
              We've paused the voice trial briefly. Please check back shortly.
            </p>
          </SectionCard>
        ) : phase === "uploaded" ? (
          <AuthGate />
        ) : (
          <div className="w-full space-y-3">
            <AudioRecorder
              prompt={FUNNEL_PROMPT}
              onRecordingComplete={handleRecordingComplete}
              stopAndSend
              uploading={phase === "uploading"}
              minDurationSeconds={MIN_DURATION_SECONDS}
              sniperMode
              sniperProfile={null}
            />
            {errorMessage && phase === "idle" && (
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
