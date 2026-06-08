"use client";

import { useState } from "react";
import { ThumbsUp, AlertTriangle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import MediaPlayer from "@/components/results/MediaPlayer";
import SpeechDataPanel from "./SpeechDataPanel";
import type { ReadoutPayload } from "./readout";

/* -------------------------------------------------------------------------- */
/*  AuditInsights — the post-publish §6b Insights view (Insights redesign v2)   */
/*                                                                            */
/*  A paged walk through the coach-CURATED set only (snippets the coach tagged   */
/*  strong / to_work_on). One analysis per page.                                */
/*                                                                            */
/*  Hierarchy (redesign v2): human-forward, data demoted.                       */
/*    Top tier (once):                                                          */
/*      • warm coach encouragement — prominent, no caps label, "— your coach"   */
/*      • coach video — COLLAPSED card ("▶ Watch your coach's note"), expands    */
/*        on tap; demoted, not full-bleed; no duration (the payload carries     */
/*        none, never hardcode one).                                            */
/*    Per snippet:                                                              */
/*      tag ("Things to double down") → audio → "What you said" (transcript,    */
/*      regular weight) → coach's note (inline attributed quote) → the speech   */
/*      data in a COLLAPSED "mathematics of your speech" panel.                 */
/*                                                                            */
/*  Split-sink (BE-verified, no leak): `features` + `stickiness` are user-lane   */
/*  topic-coherence / acoustics, NOT the private threat/challenge or salience    */
/*  vectors. The raw acoustics are kept as DATA ("voice as data") — never        */
/*  translated into a system characterization (that would be the system         */
/*  judging the voice). The machine scaffolding the old layout exposed — the     */
/*  "AUTOMATED READ" label + the raw `stickiness composite` score — is removed;  */
/*  a raw score shown at the user breaks the no-judgment promise (the coach      */
/*  interprets, the system doesn't score). The topic-coherence sentence is       */
/*  default-hidden for the same reason.                                          */
/*                                                                            */
/*  Rendered by InsightsOverlay only when ≥1 snippet is tagged; the raw /        */
/*  pre-publish case falls back to ReadoutCard. The overlay shell owns the       */
/*  header + X close.                                                           */
/* -------------------------------------------------------------------------- */

export default function AuditInsights({ payload }: { payload: ReadoutPayload }) {
  // Coach-curated set only; strong → Double down, to_work_on → Avoid.
  const analyses = payload.snippets.filter((s) => s.coach?.tag != null);
  const [cursor, setCursor] = useState(0);
  const total = analyses.length;
  const s = analyses[Math.min(cursor, total - 1)];
  // InsightsOverlay only mounts this when total > 0, but stay defensive.
  if (!s || !s.coach) return null;

  const isStrong = s.coach.tag === "strong";
  const f = s.features;

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Top tier — warm encouragement. No caps label; it's a person talking,
          not a section header. Generic "your coach" (no name field). */}
      {payload.overallMessage ? (
        <div className="rounded-2xl bg-primary/5 p-4">
          <p className="text-[17px] leading-relaxed text-foreground">
            {payload.overallMessage}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">— your coach</p>
        </div>
      ) : null}

      {/* Coach video — collapsed by default; a supporting P.S., not the
          headline. Expands + plays on tap. No duration (payload carries none). */}
      {payload.videoRef ? <CoachVideoCard src={payload.videoRef} /> : null}

      {/* progress through the curated set */}
      {total > 1 ? (
        <div className="flex items-center gap-1.5">
          {analyses.map((a, i) => (
            <span
              key={a.id || i}
              className={`h-1 flex-1 rounded-full ${
                i <= cursor ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      ) : null}

      {/* tag */}
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
        {isStrong ? "Things to double down" : "What to avoid"}
      </div>

      {/* What you said — audio + transcript (regular weight, generous
          line-height; the old multi-line italic was hard to read). */}
      <div>
        <p className="text-sm font-semibold text-foreground">What you said</p>
        <div className="mt-2">
          <MediaPlayer
            src={s.audioRef}
            startOffsetMs={s.startOffsetMs}
            durationMs={s.durationMs}
          />
        </div>
        {s.transcript ? (
          <blockquote className="mt-3 border-l-2 border-border pl-3 text-[16px] leading-relaxed text-foreground">
            {s.transcript}
          </blockquote>
        ) : null}
      </div>

      {/* Coach's note — the meaning of the moment, in the coach's own words.
          Inline attributed quote (warm left border + "— your coach"), NOT an
          orange section header. The §14 when/examples stay as the coach's
          voice, under muted (non-orange) sub-labels. */}
      {s.coach.note || s.coach.when || s.coach.examples.length > 0 ? (
        <blockquote className="border-l-2 border-primary/50 pl-3">
          {s.coach.note ? (
            <p className="text-[15px] leading-relaxed text-foreground">
              {s.coach.note}
            </p>
          ) : null}
          {s.coach.when ? (
            <>
              <p className="mt-2 text-[12px] text-muted-foreground">
                When to use it
              </p>
              <p className="mt-0.5 text-[14px] leading-relaxed text-foreground">
                {s.coach.when}
              </p>
            </>
          ) : null}
          {s.coach.examples.length > 0 ? (
            <div className="mt-2 text-[14px] text-foreground">
              <p className="text-[12px] text-muted-foreground">For example</p>
              {s.coach.examples.map((ex, i) => (
                <p key={`${i}-${ex.slice(0, 12)}`} className="mt-0.5">
                  {ex}
                </p>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-[13px] text-muted-foreground">— your coach</p>
        </blockquote>
      ) : null}

      {/* Speech data — raw acoustic figures, demoted into the shared collapsed
          panel (SpeechDataPanel). The coach review card renders the very same
          panel, so "what the user sees" and "what the coach sees" can't drift
          (C1). No translation layer — raw numbers are data; characterizing
          them would be the system judging the voice. */}
      <SpeechDataPanel features={f} />

      {/* nav */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-[12px] text-muted-foreground">
          Analysis {Math.min(cursor + 1, total)} of {total}
        </span>
        {cursor < total - 1 ? (
          <Button
            type="button"
            onClick={() => setCursor((c) => Math.min(c + 1, total - 1))}
            className="rounded-full"
          >
            Next analysis →
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------- coach video ------------------------------ */

/** Collapsed-by-default coach video. The note is a supporting P.S.: a small
 *  pill on first paint so it never pushes the analysis below the fold;
 *  expands + autoplays on tap. No duration label — `video_ref` is a bare URL
 *  with no duration (per the frozen contract); never hardcode one. */
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
      <video
        src={src}
        controls
        autoPlay
        playsInline
        className="w-full bg-black"
      />
    </div>
  );
}
