"use client";

import { useState } from "react";
import { ThumbsUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import MediaPlayer from "@/components/results/MediaPlayer";
import type { ReadoutPayload } from "./readout";

/* -------------------------------------------------------------------------- */
/*  AuditInsights — the post-publish §6b Insights view (the "Voice Audit")      */
/*                                                                            */
/*  A paged walk through the coach-CURATED set only (snippets the coach tagged   */
/*  strong / to_work_on). One analysis per page, advanced by "Next analysis →":  */
/*    strong      → "Things to double down"                                     */
/*    to_work_on  → "What to avoid"                                             */
/*  Per analysis: What (audio + quote) · Why (flat metric lines + AI stickiness  */
/*  comment-first, neutral) · When (coach note + when-guidance + examples).      */
/*  Overall coach message on top (hidden when empty). Coach video deferred.      */
/*  Untagged snippets are excluded here — they live in the raw §5 Readout.       */
/*                                                                            */
/*  Rendered by InsightsOverlay only when ≥1 snippet is tagged; the raw /        */
/*  pre-publish case falls back to ReadoutCard. Willab tokens, not the mock's    */
/*  orange theme; the overlay shell owns the header + X close.                  */
/* -------------------------------------------------------------------------- */

function hz(v: number | null): string {
  return v != null ? `${Math.round(v)} Hz` : "—";
}
function pct(v: number | null): string {
  return v != null ? `${Math.round(v * 100)}%` : "—";
}
function wpm(v: number | null): string {
  return v != null ? `${Math.round(v)} wpm` : "—";
}
function db(v: number | null): string {
  return v != null ? `${Math.round(v)} dB` : "—";
}
function dec(v: number | null): string {
  return v != null ? v.toFixed(2) : "—";
}

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
      {payload.overallMessage ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
            From your coach
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-foreground">
            {payload.overallMessage}
          </p>
        </div>
      ) : null}

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

      {/* bucket label */}
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

      {/* What */}
      <div>
        <p className="text-sm font-semibold text-foreground">What</p>
        <div className="mt-2">
          <MediaPlayer
            src={s.audioRef}
            startOffsetMs={s.startOffsetMs}
            durationMs={s.durationMs}
          />
        </div>
        {s.transcript ? (
          <blockquote
            className={`mt-3 border-l-2 pl-3 text-[17px] font-medium italic leading-relaxed text-foreground ${
              isStrong ? "border-primary" : "border-foreground"
            }`}
          >
            {s.transcript}
          </blockquote>
        ) : null}
      </div>

      {/* Why — flat metric lines + AI stickiness comment-first (neutral) */}
      <div>
        <p className="text-sm font-semibold text-foreground">Why</p>
        <div className="mt-1.5 flex flex-col gap-0.5 text-[14px] text-foreground">
          <p>
            Pitch: F0 mean {hz(f.f0Mean)} · SD {hz(f.f0Sd)}
          </p>
          <p>Pause ratio: {pct(f.pauseRatio)}</p>
          <p>Speed (words / min): {wpm(f.speechRate)}</p>
          <p>
            Volume: range {db(f.loudnessRange)} · voiced {pct(f.voicedRatio)}
          </p>
        </div>
        {s.stickiness.comment || s.stickiness.composite != null ? (
          <div className="mt-2 text-[14px]">
            {s.stickiness.comment ? (
              <p className="italic text-foreground">{s.stickiness.comment}</p>
            ) : null}
            {s.stickiness.composite != null ? (
              <p className="text-muted-foreground">
                Stickiness composite {dec(s.stickiness.composite)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* When — coach note + when-guidance + examples */}
      {s.coach.note || s.coach.when || s.coach.examples.length > 0 ? (
        <div>
          <p className="text-sm font-semibold text-foreground">When</p>
          {s.coach.note ? (
            <p className="mt-1.5 text-[14px] leading-relaxed text-foreground">
              {s.coach.note}
            </p>
          ) : null}
          {s.coach.when ? (
            <p className="mt-1.5 text-[14px] leading-relaxed text-foreground">
              {s.coach.when}
            </p>
          ) : null}
          {s.coach.examples.length > 0 ? (
            <div className="mt-2 text-[14px] text-foreground">
              <p className="text-muted-foreground">E.g.</p>
              {s.coach.examples.map((ex, i) => (
                <p key={`${i}-${ex.slice(0, 12)}`} className="mt-0.5">
                  {ex}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

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
