"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import { SlideRender } from "./pdfSlides";
import { useBackDismiss } from "./useBackDismiss";
import SnippetScreenShell from "./SnippetScreenShell";
import {
  fetchBestPresentation,
  type BestPresentationResult,
  type BestPresentationSlide,
} from "@/services/api/bestPresentation";

export default function BestPresentationOverlay({
  arcId,
  onClose,
}: {
  arcId: string;
  onClose: () => void;
}) {
  useBackDismiss(onClose);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [result, setResult] = useState<BestPresentationResult | null>(null);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    let active = true;
    void fetchBestPresentation(arcId).then((r) => {
      if (!active) return;
      setResult(r);
      setStatus(r ? "ready" : "error");
    });
    return () => {
      active = false;
    };
  }, [arcId]);

  // Pre-shell states: loading, error, not-ready, or empty slides.
  if (status === "loading" || !result) {
    return (
      <PreShellOverlay onClose={onClose}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </PreShellOverlay>
    );
  }
  if (status === "error") {
    return (
      <PreShellOverlay onClose={onClose}>
        <p className="text-[15px] text-muted-foreground">
          Couldn&apos;t load your presentation. Try again in a moment.
        </p>
      </PreShellOverlay>
    );
  }
  if (!result.ready) {
    return (
      <PreShellOverlay onClose={onClose}>
        <NotReadyState progress={result.progress} />
      </PreShellOverlay>
    );
  }
  if (result.slides.length === 0) {
    return (
      <PreShellOverlay onClose={onClose}>
        <p className="text-[15px] text-muted-foreground">
          No slide data found for this presentation.
        </p>
      </PreShellOverlay>
    );
  }

  const total = result.slides.length;
  const atLast = cursor === total - 1;

  return (
    <SnippetScreenShell
      onClose={onClose}
      index={cursor}
      total={total}
      onPrev={() => setCursor((c) => c - 1)}
      onNext={atLast ? onClose : () => setCursor((c) => c + 1)}
      nextLabel={atLast ? "Done" : undefined}
      nextTone={atLast ? "terminal" : "primary"}
      managed={false}
    >
      <SlideCard
        slide={result.slides[cursor]}
        presentationRef={result.presentationRef}
      />
    </SnippetScreenShell>
  );
}

/* ── minimal fixed overlay for pre-shell states ── */

function PreShellOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 justify-end px-3 pt-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-border text-muted-foreground"
        >
          <X className="h-[17px] w-[17px]" aria-hidden />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center px-8 text-center">
        {children}
      </div>
    </div>
  );
}

/* ── not-ready state ── */

function NotReadyState({
  progress,
}: {
  progress: { takesDone: number; takesTarget: number; takesRemaining: number };
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-[15px] text-foreground">
        Your best presentation needs {progress.takesRemaining} more{" "}
        {progress.takesRemaining === 1 ? "take" : "takes"} — minimum 3.
      </p>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width: `${Math.round(
              (progress.takesDone / progress.takesTarget) * 100
            )}%`,
          }}
          role="progressbar"
          aria-valuenow={progress.takesDone}
          aria-valuemin={0}
          aria-valuemax={progress.takesTarget}
          aria-label="Sessions complete"
        />
      </div>
      <p className="text-[12px] text-muted-foreground">
        {progress.takesDone} of {progress.takesTarget} sessions complete
      </p>
    </div>
  );
}

/* ── per-slide card body ── */

function SlideCard({
  slide,
  presentationRef,
}: {
  slide: BestPresentationSlide;
  presentationRef: string | null;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const hasContent = slide.text.length > 0 || slide.audioRef !== null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      {/* Slide visual */}
      <SlideRender
        presentationRef={presentationRef}
        pageIndex={slide.index}
        title={slide.title}
        body=""
        className="w-full"
      />

      {/* Breakthrough badge */}
      {slide.breakthrough ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={slide.breakthroughNote ? () => setNoteOpen((v) => !v) : undefined}
            disabled={!slide.breakthroughNote}
            aria-expanded={slide.breakthroughNote ? noteOpen : undefined}
            className="flex items-center gap-1.5 self-start rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            You turned your stress into charisma.
          </button>
          {noteOpen && slide.breakthroughNote ? (
            <p className="pl-1 text-[12px] leading-snug text-muted-foreground">
              {slide.breakthroughNote}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Audio + composed text */}
      {hasContent ? (
        <>
          {slide.audioRef ? (
            <MediaPlayer src={slide.audioRef} startOffsetMs={0} durationMs={0} />
          ) : null}
          {slide.text ? (
            <p className="text-[15px] leading-relaxed text-foreground">
              {slide.text}
            </p>
          ) : null}
          {/* provenance */}
          <p className="text-[11px] text-muted-foreground">
            from your take {slide.takeIndex}
          </p>
        </>
      ) : (
        <p className="text-[14px] italic text-muted-foreground">
          No best recording for this slide yet.
        </p>
      )}
    </div>
  );
}
