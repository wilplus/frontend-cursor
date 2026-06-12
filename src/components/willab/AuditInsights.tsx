"use client";

import { type ReactNode, useState } from "react";
import { AlertTriangle, ChevronLeft, Play, ThumbsUp } from "lucide-react";
import { SlideTake, type SlideTakeEntry } from "./SlideTake";
import type { ReadoutPayload, ReadoutSnippet } from "./readout";

/* -------------------------------------------------------------------------- */
/*  AuditInsights — Phase 2 unified Coach Insights.                           */
/*                                                                            */
/*  Reuses the shared SlideTake component (same shell as Trainings) with       */
/*  an Avoid! / Do more! verdict badge as the topBar on every snippet slide.   */
/*                                                                            */
/*  Navigation: swipe / arrows / dots through tagged snippets, then           */
/*  "From your tutor" summary (overall message + coach video + per-snippet     */
/*  notes + orange Close CTA).                                                */
/*                                                                            */
/*  Rendered by InsightsOverlay only when at least one snippet is tagged.     */
/* -------------------------------------------------------------------------- */

const TAG_ORDER: Record<string, number> = { to_work_on: 0, strong: 1 };

function buildEntry(s: ReadoutSnippet, payload: ReadoutPayload): SlideTakeEntry {
  const isStrong = s.coach?.tag === "strong";
  const c = s.coach;
  const hasAdvise = !!(
    c && (c.note || c.when || (c.examples && c.examples.length > 0))
  );

  const advise: ReactNode | null = hasAdvise && c ? (
    <div className="flex flex-col gap-3">
      {c.note ? (
        <p className="text-[15px] leading-relaxed text-foreground">{c.note}</p>
      ) : null}
      {c.when ? (
        <>
          <p className="text-[12px] text-muted-foreground">When to use it</p>
          <p className="text-[14px] leading-relaxed text-foreground">{c.when}</p>
        </>
      ) : null}
      {c.examples && c.examples.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-[12px] text-muted-foreground">For example</p>
          {c.examples.map((ex, i) => (
            <p key={i} className="text-[14px] text-foreground">
              {ex}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  ) : null;

  return {
    key: s.id || String(s.startOffsetMs),
    presentationRef: payload.presentationRef,
    slideIndex: s.slide?.index ?? 0,
    topBar: (
      <div
        className={`flex items-center gap-2 ${
          isStrong ? "text-primary" : "text-foreground"
        }`}
      >
        {isStrong ? (
          <ThumbsUp className="h-5 w-5" aria-hidden />
        ) : (
          <AlertTriangle className="h-5 w-5" aria-hidden />
        )}
        <span className="text-[20px] font-semibold">
          {isStrong ? "Do more!" : "Avoid!"}
        </span>
      </div>
    ),
    audioRef: s.audioRef,
    startOffsetMs: s.startOffsetMs,
    durationMs: s.durationMs,
    transcript: s.transcript || null,
    advise,
    features: s.features ?? null,
  };
}

export default function AuditInsights({
  payload,
  onClose,
}: {
  payload: ReadoutPayload;
  /** Passed down so the summary's Close CTA can dismiss the overlay. */
  onClose?: () => void;
}) {
  const analyses = payload.snippets
    .filter((s) => s.coach?.tag != null)
    .slice()
    .sort(
      (a, b) =>
        (TAG_ORDER[a.coach?.tag ?? ""] ?? 2) -
        (TAG_ORDER[b.coach?.tag ?? ""] ?? 2)
    );

  const entries = analyses.map((s) => buildEntry(s, payload));
  const [cursor, setCursor] = useState(0);

  if (analyses.length === 0) return null;

  const onSummary = cursor >= entries.length;

  if (onSummary) {
    return (
      <CoachSummary
        payload={payload}
        analyses={analyses}
        onBack={() => setCursor(entries.length - 1)}
        onClose={onClose}
      />
    );
  }

  return (
    <SlideTake
      entries={entries}
      slideIdx={cursor}
      onSlideIdx={setCursor}
      onAfterLast={() => setCursor(entries.length)}
    />
  );
}

/* ------------------------------- coach summary ----------------------------- */

function CoachSummary({
  payload,
  analyses,
  onBack,
  onClose,
}: {
  payload: ReadoutPayload;
  analyses: ReadoutSnippet[];
  onBack: () => void;
  onClose?: () => void;
}) {
  const notes = analyses.filter(
    (a) =>
      a.coach &&
      (a.coach.note || a.coach.when || (a.coach.examples && a.coach.examples.length > 0))
  );
  const empty =
    !payload.overallMessage && !payload.videoRef && notes.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-10 pt-2">
      {/* Heading — Trainings-title style */}
      <h2 className="text-[22px] font-semibold text-foreground">From your tutor</h2>

      {/* Orange-bg overall note */}
      {payload.overallMessage ? (
        <div className="rounded-2xl bg-primary/[0.12] p-4">
          <p className="text-[17px] leading-relaxed text-foreground">
            {payload.overallMessage}
          </p>
        </div>
      ) : null}

      {/* Coach video */}
      {payload.videoRef ? <CoachVideoCard src={payload.videoRef} /> : null}

      {/* Per-snippet notes */}
      {notes.length > 0 ? (
        <div className="flex flex-col gap-4">
          {notes.map((a, i) => (
            <CoachNote key={a.id || String(i)} snippet={a} />
          ))}
        </div>
      ) : null}

      {/* Empty state */}
      {empty ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          No written notes this time. The tag on each snippet is your coach&apos;s
          call on it.
        </p>
      ) : null}

      {/* Navigation */}
      <div className="flex flex-col gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-2 rounded-full bg-muted py-4 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted/70"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-full bg-primary py-4 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ─────────────────────────── coach note card ───────────────────────────── */

function CoachNote({ snippet }: { snippet: ReadoutSnippet }) {
  const c = snippet.coach;
  if (!c) return null;
  const isStrong = c.tag === "strong";

  return (
    <div className="rounded-2xl border border-border p-4">
      <div
        className={`flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide ${
          isStrong ? "text-primary" : "text-foreground"
        }`}
      >
        {isStrong ? (
          <ThumbsUp className="h-4 w-4" aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4" aria-hidden />
        )}
        {isStrong ? "Do more" : "Avoid"}
      </div>
      {c.note ? (
        <p className="mt-2 text-[15px] leading-relaxed text-foreground">{c.note}</p>
      ) : null}
      {c.when ? (
        <>
          <p className="mt-2 text-[12px] text-muted-foreground">When to use it</p>
          <p className="mt-0.5 text-[14px] leading-relaxed text-foreground">
            {c.when}
          </p>
        </>
      ) : null}
      {c.examples && c.examples.length > 0 ? (
        <div className="mt-2 text-[14px] text-foreground">
          <p className="text-[12px] text-muted-foreground">For example</p>
          {c.examples.map((ex, i) => (
            <p key={`${i}-${ex.slice(0, 12)}`} className="mt-0.5">
              {ex}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────────── coach video card ──────────────────────────── */

/** Collapsed pill on first paint — expands + autoplays on tap. */
function CoachVideoCard({ src }: { src: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 self-start rounded-full border border-border px-4 py-2 text-[14px] text-foreground transition-colors hover:border-primary/50"
      >
        <Play className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        Watch your coach&apos;s note
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video src={src} controls autoPlay playsInline className="w-full bg-black" />
    </div>
  );
}
