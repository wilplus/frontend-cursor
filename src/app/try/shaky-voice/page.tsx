"use client";

import { Suspense, useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import RecorderCard from "@/components/funnel/RecorderCard";
import AuthGate from "@/components/funnel/AuthGate";
import FunnelReturnToast from "@/components/funnel/FunnelReturnToast";
import SectionCard from "@/components/admin/SectionCard";
import {
  GuestUploadFailure,
  uploadGuestRecording,
} from "@/lib/api/public-client";

type Phase = "idle" | "uploading" | "uploaded" | "rate_limited" | "disabled";

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
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Suspense fallback={null}>
        <FunnelReturnToast />
      </Suspense>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-20">
        <header className="mb-8 text-center">
          <p className="mb-2 text-sm font-medium text-orange-600">
            Curiosity Gate · 15-second voice trial
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">
            Hear what your voice reveals.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Record a quick 15-second clip. Our AI builds your Behavioral Profile and a
            tailored practice task — free, no signup needed to record.
          </p>
        </header>

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
          <div className="space-y-4">
            <RecorderCard
              onComplete={handleRecordingComplete}
              disabled={phase === "uploading"}
            />
            {phase === "uploading" && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading your clip…
              </div>
            )}
            {errorMessage && phase === "idle" && (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {errorMessage}
              </p>
            )}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          We don't analyze your audio until you create a free account. No PII required to record.
        </p>
      </div>
    </main>
  );
}
