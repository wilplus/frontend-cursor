"use client";

import type { ReactNode } from "react";
import { CoachChip, CoachErrorLine } from "./coachChrome";
import {
  CONFIDENCE_QUESTION,
  type TernaryValue,
} from "@/services/api/stateRatings";

/* -------------------------------------------------------------------------- */
/*  ConfidenceLabelChips — THE one confident-voice instrument (founder         */
/*  2026-08-10: "the confident voice label should has the same UI as the       */
/*  coach based labelling and the voice game labelling").                      */
/*                                                                            */
/*  Extracted verbatim from CoachSnippetReviewCard, the reference lane: three  */
/*  answer chips — Yes / No / Ambiguous (the founder's yes / no / idk; the     */
/*  third answer is a judgment about the MOMENT, the backend's `neutral`) —    */
/*  plus the SECONDARY abstention below ("Can't rate this — audio unclear"),   */
/*  which is a judgment about the RATER and deliberately not a fourth chip:    */
/*  giving it chip weight is what books bad audio as a real middling rating.   */
/*                                                                            */
/*  Every lane — the coach snippet card, the Feedbacks review, the training    */
/*  corpus, the voice game, the ideal-text modal — renders THIS component,     */
/*  so the instrument cannot drift per surface.                               */
/* -------------------------------------------------------------------------- */

export const RATING_OPTIONS: { value: TernaryValue; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "neutral", label: "Ambiguous" },
];

export default function ConfidenceLabelChips({
  question = CONFIDENCE_QUESTION,
  value,
  unrateable = false,
  disabled = false,
  saving = false,
  error = null,
  eyebrow = null,
  onPick,
  onToggleUnrateable,
}: {
  /** null hides the question line — for hosts that render the question as
   *  their own hero (the game's big centered ask). */
  question?: string | null;
  value: TernaryValue | null;
  unrateable?: boolean;
  disabled?: boolean;
  saving?: boolean;
  error?: string | null;
  /** Small right-of-question tag (the coach lanes show "Private · training"). */
  eyebrow?: ReactNode;
  onPick: (value: TernaryValue) => void;
  /** Omit to hide the abstention where an abstention isn't offered. */
  onToggleUnrateable?: () => void;
}) {
  return (
    <div>
      {question !== null ? (
        <p className="text-sm font-semibold text-foreground">
          {question}
          {eyebrow}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {RATING_OPTIONS.map((r) => (
          <CoachChip
            key={r.value}
            active={value === r.value && !unrateable}
            onClick={() => {
              if (!disabled) onPick(r.value);
            }}
          >
            {r.label}
          </CoachChip>
        ))}
      </div>
      {onToggleUnrateable ? (
        <button
          type="button"
          onClick={() => {
            if (!disabled) onToggleUnrateable();
          }}
          aria-pressed={unrateable}
          className={`mt-3 text-[12px] underline underline-offset-2 transition-colors ${
            unrateable
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {unrateable ? "Marked unrateable" : "Can't rate this — audio unclear"}
        </button>
      ) : null}
      {saving ? (
        <p className="mt-1 text-[12px] text-muted-foreground">Saving…</p>
      ) : null}
      {error ? <CoachErrorLine>{error}</CoachErrorLine> : null}
    </div>
  );
}
