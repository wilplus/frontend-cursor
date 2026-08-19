"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import {
  fetchConfidencePractice,
  type ConfidencePractice,
} from "@/services/api/confidentVoicePractice";
import { useBackDismiss } from "@/components/willab/useBackDismiss";

/** Read-only destination for a coach-shared Chat bubble. It opens the exact
 * exercise and audio context without reopening any presentation journey. */
export default function ConfidencePracticeOverlay({
  practiceId,
  onClose,
}: {
  practiceId: string;
  onClose: () => void;
}) {
  useBackDismiss(onClose);
  const [practice, setPractice] = useState<ConfidencePractice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchConfidencePractice(practiceId).then((result) => {
      if (!alive) return;
      setLoading(false);
      if (result.ok) setPractice(result.practice);
      else setError(result.error ?? "Couldn't open this exercise.");
    });
    return () => { alive = false; };
  }, [practiceId]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Coach exercise
          </p>
          <h2 className="text-[17px] font-semibold text-foreground">
            {practice?.exercise.title ?? "Exercise"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border p-2 text-muted-foreground hover:bg-muted"
          aria-label="Close exercise"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>
      <main className="scrollbar-none flex-1 overflow-y-auto overscroll-contain px-5 py-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Loading exercise…
            </div>
          ) : error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[14px] text-destructive">
              {error}
            </p>
          ) : practice ? (
            <>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                {practice.exercise.instruction}
              </p>
              {practice.exercise.explanationVideoRef ? (
                <div className="overflow-hidden rounded-2xl border border-border bg-black">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    src={practice.exercise.explanationVideoRef}
                    controls
                    playsInline
                    className="max-h-80 w-full"
                  />
                </div>
              ) : null}
              <div className="rounded-2xl border border-border bg-muted/35 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Exact passage
                </p>
                <p className="mt-2 text-[17px] font-medium leading-relaxed text-foreground">
                  {practice.passage}
                </p>
              </div>
              {practice.originalAudioRef ? (
                <div className="rounded-2xl border border-border p-4">
                  <p className="mb-2 text-[12px] font-medium text-muted-foreground">Original moment</p>
                  <MediaPlayer
                    src={practice.originalAudioRef}
                    startOffsetMs={practice.originalStartOffsetMs}
                    durationMs={practice.originalDurationMs}
                  />
                </div>
              ) : null}
              {practice.attempts.map((attempt) => (
                <div key={attempt.id} className="rounded-2xl border border-border p-4">
                  <p className="mb-2 text-[12px] font-medium text-muted-foreground">
                    Attempt {attempt.attemptIndex}{attempt.isStrongest ? " · clearest" : ""}
                  </p>
                  <MediaPlayer src={attempt.audioRef} startOffsetMs={0} durationMs={attempt.durationMs} />
                  <p className="mt-2 text-[13px] leading-relaxed text-foreground">
                    {attempt.assessment}
                  </p>
                </div>
              ))}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
