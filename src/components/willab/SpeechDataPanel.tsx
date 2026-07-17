"use client";

import type { ReadoutFeatures } from "./readout";

/* -------------------------------------------------------------------------- */
/*  SpeechDataPanel — the collapsed acoustic "speech data" panel, SHARED        */
/*  between the user Insights view (AuditInsights) and the coach review card    */
/*  (CoachSnippetReviewCard) so both surfaces render the SAME figures the same  */
/*  way. This is C1's literal ask ("the coach sees the same speech-data panel   */
/*  the user gets") and the first concrete step of U13 (unify overlay parts     */
/*  behind shared primitives instead of copy-pasted markup that drifts).        */
/*                                                                            */
/*  Split-sink / AC-9: these are the USER-LANE acoustic features (the same      */
/*  11-vector the user already sees) — reference DATA, never a verdict. No       */
/*  best/worst flag, no direction guess, no characterization. Native <details>  */
/*  so the figures stay in the DOM + reachable (not display:none, not deleted); │
/*  no translation layer — raw numbers are data, characterizing them would be   */
/*  the system judging the voice.                                               */
/*                                                                            */
/*  `label` lets the surface set the possessive correctly: the user sees "your  */
/*  speech"; the coach is looking at someone else's snippet, so it passes a      */
/*  neutral label ("Speech data") — never "your".                               */
/* -------------------------------------------------------------------------- */

/** The shared unit formatters — exported so every surface showing these
 *  figures (this panel, the coach card's FE-7 acoustic disclosure) rounds and
 *  labels them identically and can't drift. */
export const hz = (v: number | null): string =>
  v != null ? `${Math.round(v)} Hz` : "—";
export const pct = (v: number | null): string =>
  v != null ? `${Math.round(v * 100)}%` : "—";
export const wpm = (v: number | null): string =>
  v != null ? `${Math.round(v)} wpm` : "—";
export const db = (v: number | null): string =>
  v != null ? `${Math.round(v)} dB` : "—";

export default function SpeechDataPanel({
  features,
  label = "The mathematics of your speech",
}: {
  features: ReadoutFeatures;
  label?: string;
}) {
  return (
    <details className="rounded-xl border border-border bg-muted/20">
      <summary className="cursor-pointer list-none px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground">
        ▸ {label}
      </summary>
      <div className="flex flex-col gap-0.5 px-3 pb-3 text-[13px] text-muted-foreground">
        <p>
          Pitch: F0 mean {hz(features.f0Mean)} · SD {hz(features.f0Sd)}
        </p>
        <p>Pause ratio: {pct(features.pauseRatio)}</p>
        <p>Speed (words / min): {wpm(features.speechRate)}</p>
        <p>
          Volume: range {db(features.loudnessRange)} · voiced{" "}
          {pct(features.voicedRatio)}
        </p>
      </div>
    </details>
  );
}
