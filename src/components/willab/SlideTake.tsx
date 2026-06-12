"use client";

import { type ReactNode, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import { SlideRender } from "./pdfSlides";
import type { ReadoutFeatures } from "./readout";

/* -------------------------------------------------------------------------- */
/*  SlideTake — shared slide-viewer used by Trainings (LibraryOverlay) and    */
/*  Coach Insights (AuditInsights).                                           */
/*                                                                            */
/*  Layout per entry: slide image edge-to-edge (swipe / arrows / dots) →     */
/*  optional topBar → MediaPlayer → transcript → Advise ▾ → Data ▾.          */
/*                                                                            */
/*  Phase 1 (Trainings): topBar = bold take title ("Take 3").                 */
/*  Phase 2 (Coach Insights): topBar = Avoid! / Do more! verdict badge.       */
/* -------------------------------------------------------------------------- */

export interface SlideTakeEntry {
  /** Stable key — used to key the pagination dots. */
  key: string;
  presentationRef: string | null;
  slideIndex: number;
  /** Rendered at the top of the content area below the slide image.
   *  Trainings: bold take title. Coach Insights: verdict badge.
   *  When null/undefined AND audioRef+transcript are absent, the empty-state
   *  message shows instead ("No standout moment on this slide yet."). */
  topBar?: ReactNode;
  audioRef?: string | null;
  startOffsetMs?: number;
  durationMs?: number;
  transcript?: string | null;
  /** Content of the Advise toggle. null = hide the toggle entirely. */
  advise?: ReactNode | null;
  /** Acoustic features for the Data toggle. null = hide. */
  features?: ReadoutFeatures | null;
}

export function SlideTake({
  entries,
  slideIdx,
  onSlideIdx,
  onAfterLast,
}: {
  entries: SlideTakeEntry[];
  slideIdx: number;
  onSlideIdx: (i: number) => void;
  /** Called when the user navigates forward past the last entry — used by
   *  Coach Insights to transition to the "From your tutor" summary page.
   *  When present, the right arrow also appears on the last entry. */
  onAfterLast?: () => void;
}) {
  const total = entries.length;
  const entry = entries[slideIdx];
  const touchX = useRef<number | null>(null);

  const go = (dir: -1 | 1) => {
    const next = slideIdx + dir;
    if (next < 0) return;
    if (next >= total) {
      onAfterLast?.();
      return;
    }
    onSlideIdx(next);
  };

  if (!entry) return null;

  const hasContent =
    entry.topBar != null ||
    (typeof entry.audioRef === "string" && entry.audioRef.length > 0) ||
    (typeof entry.transcript === "string" && entry.transcript.length > 0);

  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      {/* Slide — edge-to-edge, touch-swipeable */}
      <div
        className="relative w-full select-none"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        <div className="aspect-video w-full bg-muted">
          {entry.presentationRef ? (
            <SlideRender
              presentationRef={entry.presentationRef}
              pageIndex={entry.slideIndex}
              title=""
              body=""
              className="h-full w-full"
            />
          ) : (
            <SlidePlaceholder className="h-full w-full" />
          )}
        </div>

        {slideIdx > 0 ? <NavBtn side="left" onClick={() => go(-1)} /> : null}
        {slideIdx < total - 1 || onAfterLast ? (
          <NavBtn side="right" onClick={() => go(1)} />
        ) : null}

        {total > 1 ? (
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {entries.map((e, i) => (
              <span
                key={e.key}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === slideIdx ? "bg-white/90" : "bg-white/30"
                }`}
                aria-hidden
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-5 px-4 pt-4">
        {hasContent ? (
          <>
            {entry.topBar ?? null}

            {entry.audioRef ? (
              <MediaPlayer
                src={entry.audioRef}
                startOffsetMs={entry.startOffsetMs ?? 0}
                durationMs={entry.durationMs ?? 0}
              />
            ) : null}

            {entry.transcript ? (
              <p className="text-[15px] leading-relaxed text-foreground">
                {entry.transcript}
              </p>
            ) : null}

            {entry.advise ? (
              <Toggle title="Advise">{entry.advise}</Toggle>
            ) : null}

            {entry.features ? (
              <Toggle title="Data">
                <FeaturesData features={entry.features} />
              </Toggle>
            ) : null}
          </>
        ) : (
          <p className="text-[15px] text-muted-foreground">
            No standout moment on this slide yet.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── exported sub-components ───────────────────────── */

/** Placeholder shown when no presentation PDF is attached. */
export function SlidePlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-muted ${className ?? ""}`}
      aria-label="No slide uploaded"
    >
      <ImageIcon className="h-7 w-7 text-muted-foreground/40" aria-hidden />
    </div>
  );
}

/* ─────────────────────── private helpers ───────────────────────────────── */

function NavBtn({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous slide" : "Next slide"}
      className={`absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      {side === "left" ? (
        <ChevronLeft className="h-5 w-5" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
    </button>
  );
}

function Toggle({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5"
      >
        <span className="text-[15px] font-semibold text-foreground">{title}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

function FeaturesData({ features: f }: { features: ReadoutFeatures }) {
  const hz = (v: number | null) => (v != null ? `${Math.round(v)} Hz` : "-");
  const pct = (v: number | null) => (v != null ? `${Math.round(v * 100)}%` : "-");
  const spd = (v: number | null) => (v != null ? `${Math.round(v)} wpm` : "-");
  const db = (v: number | null) => (v != null ? `${Math.round(v)} dB` : "-");
  return (
    <div className="flex flex-col gap-1 text-[15px] leading-relaxed text-foreground">
      <p>Pitch: F0 mean {hz(f.f0Mean)}, SD {hz(f.f0Sd)}</p>
      <p>Pace: {spd(f.speechRate)}, pause {pct(f.pauseRatio)}</p>
      <p>Volume: range {db(f.loudnessRange)}, voiced {pct(f.voicedRatio)}</p>
    </div>
  );
}
