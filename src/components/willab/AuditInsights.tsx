"use client";

import { useState } from "react";
import {
  ThumbsUp,
  AlertTriangle,
  Play,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import SpeechDataPanel from "./SpeechDataPanel";
import { SlideRender } from "./pdfSlides";
import type { ReadoutPayload, ReadoutSnippet } from "./readout";

/* -------------------------------------------------------------------------- */
/*  AuditInsights — the post-publish §6b Insights view                          */
/*                                                                            */
/*  A paged walk through the coach-CURATED snippets (the ones the coach tagged   */
/*  strong / to_work_on), one per page, then a final "From your coach" summary.  */
/*                                                                            */
/*  Per snippet — clean, your-delivery-first, no coach prose:                   */
/*    verdict tag ("Avoid" / "Do more") as the heading → the slide on screen     */
/*    during the moment → "What you said" (audio + transcript) → the acoustics    */
/*    in a collapsed "mathematics of your speech" panel.                         */
/*                                                                            */
/*  The coach's words — the overall note, the coach video, and each snippet's    */
/*  written note — are gathered onto the FINAL summary page (reached by Next),    */
/*  so the walk reads as your own delivery first and the coach's read second,     */
/*  instead of a coach quote stapled under every clip.                           */
/*                                                                            */
/*  Split-sink (BE-verified): `features` / `stickiness` are user-lane acoustics, */
/*  kept as raw DATA — never characterized (that would be the system judging      */
/*  the voice). The tag is the COACH's verdict echoed back, not a system score.   */
/*                                                                            */
/*  Rendered by InsightsOverlay only when ≥1 snippet is tagged; the X-only        */
/*  overlay shell owns the close.                                               */
/* -------------------------------------------------------------------------- */

// Walk order: to-work-on first, then double-down (strong). Stable within group.
const TAG_ORDER: Record<string, number> = { to_work_on: 0, strong: 1 };
const tagLabel = (tag: string | null) => (tag === "strong" ? "Do more" : "Avoid");

export default function AuditInsights({ payload }: { payload: ReadoutPayload }) {
  const analyses = payload.snippets
    .filter((s) => s.coach?.tag != null)
    .slice()
    .sort(
      (a, b) =>
        (TAG_ORDER[a.coach?.tag ?? ""] ?? 2) -
        (TAG_ORDER[b.coach?.tag ?? ""] ?? 2)
    );
  const total = analyses.length;
  // Pages: [0 .. total-1] the snippets, then [total] the coach summary.
  const [cursor, setCursor] = useState(0);
  if (total === 0) return null; // InsightsOverlay only mounts us when total > 0.

  const summaryIndex = total;
  const onSummary = cursor >= summaryIndex;

  return (
    <div className="flex flex-col gap-5 pb-8">
      {onSummary ? (
        <CoachSummary payload={payload} analyses={analyses} />
      ) : (
        <SnippetPage snippet={analyses[cursor]} payload={payload} />
      )}

      {/* nav — grey Back + orange Next (matches the readout). Next runs past the
          last snippet onto the coach summary; the overlay X is the only exit. */}
      <div className="flex items-stretch gap-3 pt-1">
        <button
          type="button"
          onClick={() => setCursor((c) => Math.max(c - 1, 0))}
          disabled={cursor === 0}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-muted py-4 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted/70 disabled:opacity-40"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
        <button
          type="button"
          onClick={() => setCursor((c) => Math.min(c + 1, summaryIndex))}
          disabled={onSummary}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-4 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- snippet page ----------------------------- */

function SnippetPage({
  snippet,
  payload,
}: {
  snippet: ReadoutSnippet;
  payload: ReadoutPayload;
}) {
  if (!snippet.coach) return null;
  const isStrong = snippet.coach.tag === "strong";

  return (
    <>
      {/* The coach's verdict for this moment — the heading (it replaces the old
          coach bubble + caps tag; the prose itself moves to the summary). */}
      <div
        className={`flex items-center gap-2 ${
          isStrong ? "text-primary" : "text-foreground"
        }`}
      >
        {isStrong ? (
          <ThumbsUp className="h-6 w-6" aria-hidden />
        ) : (
          <AlertTriangle className="h-6 w-6" aria-hidden />
        )}
        <span className="text-[22px] font-semibold">
          {tagLabel(snippet.coach.tag)}
        </span>
      </div>

      {/* The slide on screen during this moment (deck attached): the rendered
          PDF page, or its text card. null when no deck → nothing renders. */}
      {snippet.slide ? (
        <SlideRender
          presentationRef={payload.presentationRef}
          pageIndex={snippet.slide.index}
          title={snippet.slide.title}
          body={snippet.slide.body}
          className="w-full"
        />
      ) : null}

      {/* What you said — audio + transcript. */}
      <div>
        <p className="text-sm font-semibold text-foreground">What you said</p>
        <div className="mt-2">
          <MediaPlayer
            src={snippet.audioRef}
            startOffsetMs={snippet.startOffsetMs}
            durationMs={snippet.durationMs}
          />
        </div>
        {snippet.transcript ? (
          <blockquote className="mt-3 border-l-2 border-border pl-3 text-[16px] leading-relaxed text-foreground">
            {snippet.transcript}
          </blockquote>
        ) : null}
      </div>

      {/* Speech data — raw acoustics, demoted into the shared collapsed panel
          (the coach review card renders the same one, so the two can't drift). */}
      <SpeechDataPanel features={snippet.features} />
    </>
  );
}

/* ------------------------------ coach summary ----------------------------- */

/** The final page — the coach's read, gathered in one place: the overall note,
 *  the coach video, and every snippet's written note (each under its own
 *  Avoid / Do more tag). No "— your coach" footer; the page header says it. */
function CoachSummary({
  payload,
  analyses,
}: {
  payload: ReadoutPayload;
  analyses: ReadoutSnippet[];
}) {
  const notes = analyses.filter(
    (a) => a.coach && (a.coach.note || a.coach.when || a.coach.examples.length > 0)
  );
  const empty =
    !payload.overallMessage && !payload.videoRef && notes.length === 0;

  return (
    <>
      <h2 className="text-[22px] font-semibold text-foreground">
        From your coach
      </h2>

      {payload.overallMessage ? (
        <div className="rounded-2xl bg-primary/5 p-4">
          <p className="text-[17px] leading-relaxed text-foreground">
            {payload.overallMessage}
          </p>
        </div>
      ) : null}

      {payload.videoRef ? <CoachVideoCard src={payload.videoRef} /> : null}

      {notes.length > 0 ? (
        <div className="flex flex-col gap-4">
          {notes.map((a, i) => (
            <CoachNote key={a.id || i} snippet={a} />
          ))}
        </div>
      ) : null}

      {empty ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          No written notes this time. The tag on each snippet is your coach&apos;s
          call on it.
        </p>
      ) : null}
    </>
  );
}

/** One snippet's coach note in the summary — its tag, the note, and the §14
 *  when / examples, all in the coach's voice under muted sub-labels. */
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
        {tagLabel(c.tag)}
      </div>
      {c.note ? (
        <p className="mt-2 text-[15px] leading-relaxed text-foreground">
          {c.note}
        </p>
      ) : null}
      {c.when ? (
        <>
          <p className="mt-2 text-[12px] text-muted-foreground">When to use it</p>
          <p className="mt-0.5 text-[14px] leading-relaxed text-foreground">
            {c.when}
          </p>
        </>
      ) : null}
      {c.examples.length > 0 ? (
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

/* ------------------------------- coach video ------------------------------ */

/** Collapsed-by-default coach video. A small pill on first paint so it never
 *  pushes the summary below the fold; expands + autoplays on tap. No duration
 *  label — `video_ref` is a bare URL with no duration; never hardcode one. */
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
