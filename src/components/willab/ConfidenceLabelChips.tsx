"use client";

import type { ReactNode } from "react";
import { Check, CircleHelp, Minus, VolumeX, X } from "lucide-react";
import { CoachErrorLine } from "./coachChrome";
import {
  CONFIDENCE_QUESTION,
  type ConfidenceRatingValue,
} from "@/services/api/stateRatings";

/* -------------------------------------------------------------------------- */
/*  The one blind confidence-rating instrument. The answer vocabulary and the */
/*  visual hierarchy are shared by coach and peer corpus labeling. Primary    */
/*  controls are perceptual judgments; secondary controls preserve rater      */
/*  uncertainty and technical audio failure as distinct stored values.        */
/* -------------------------------------------------------------------------- */

type RatingOption = {
  value: ConfidenceRatingValue;
  label: string;
  icon: typeof Check;
};

export const PRIMARY_RATING_OPTIONS: RatingOption[] = [
  { value: "yes", label: "Yes", icon: Check },
  { value: "in_between", label: "In-between", icon: Minus },
  { value: "no", label: "No", icon: X },
];

export const SECONDARY_RATING_OPTIONS: RatingOption[] = [
  { value: "not_sure", label: "Not sure", icon: CircleHelp },
  { value: "audio_unclear", label: "Audio unclear", icon: VolumeX },
];

/** The owner's and the coach's words ("Yes — Confident"); the coach panel's
 *  Judge screen draws them too (coach panel redrawn, 2026-10-06). */
export const OWNER_PRIMARY_RATING_OPTIONS: RatingOption[] = [
  { value: "yes", label: "Yes — Confident", icon: Check },
  { value: "in_between", label: "In-between", icon: Minus },
  { value: "no", label: "No — Not confident", icon: X },
];

/** The speaker's own judgement sheet (founder 2026-10-05, N48.3 Q8 A: the
 *  design draws "Yes" and "No"). The same five tall answers as the owner
 *  wording; the coach panel's instrument keeps the wording above. */
const SPEAKER_PRIMARY_RATING_OPTIONS: RatingOption[] = [
  { value: "yes", label: "Yes", icon: Check },
  { value: "in_between", label: "In-between", icon: Minus },
  { value: "no", label: "No", icon: X },
];

export default function ConfidenceLabelChips({
  question = CONFIDENCE_QUESTION,
  value,
  unrateable = false,
  disabled = false,
  saving = false,
  error = null,
  eyebrow = null,
  ownerWording = false,
  speakerWording = false,
  onPick,
}: {
  /** null hides the question line — for hosts that render the question as
   *  their own hero (the game's big centered ask). */
  question?: string | null;
  value: ConfidenceRatingValue | null;
  /** Read compatibility for historical rows. New writes use audio_unclear. */
  unrateable?: boolean;
  disabled?: boolean;
  saving?: boolean;
  error?: string | null;
  /** Small right-of-question tag (the coach lanes show "Private · training"). */
  eyebrow?: ReactNode;
  /** Exact self-report wording; blind-rater controls keep their neutral labels. */
  ownerWording?: boolean;
  /** The speaker's own judgement sheet: the owner layout with the
   *  speaker's signed answers, "Yes" and "No" (N48.3 Q8 A). */
  speakerWording?: boolean;
  onPick: (value: ConfidenceRatingValue) => void;
}) {
  const selected = unrateable ? "audio_unclear" : value;
  const primaryOptions = speakerWording
    ? SPEAKER_PRIMARY_RATING_OPTIONS
    : ownerWording
      ? OWNER_PRIMARY_RATING_OPTIONS
      : PRIMARY_RATING_OPTIONS;
  const questionLine =
    question !== null ? (
      <p className="text-sm font-semibold text-foreground">
        {question}
        {eyebrow}
      </p>
    ) : null;
  const status = (
    <>
      {saving ? (
        <p className="mt-1 text-[12px] text-muted-foreground">Saving…</p>
      ) : null}
      {error ? <CoachErrorLine>{error}</CoachErrorLine> : null}
    </>
  );
  if (ownerWording || speakerWording) {
    return (
      <div>
        {questionLine}
        <OwnerAnswers
          options={primaryOptions}
          selected={selected}
          disabled={disabled}
          onPick={onPick}
        />
        {status}
      </div>
    );
  }
  return (
    <div>
      {questionLine}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {primaryOptions.map((option) => {
          const Icon = option.icon;
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onPick(option.value)}
              className={`flex min-h-[5.25rem] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:border-foreground/50 hover:bg-muted/40"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
              <span className="text-sm font-semibold">{option.label}</span>
            </button>
          );
        })}
      </div>

      <div className="my-3 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Other
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {SECONDARY_RATING_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onPick(option.value)}
              className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? "border-foreground bg-muted text-foreground"
                  : "border-border/80 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
      {status}
    </div>
  );
}

/** The owner's own judgement (founder 2026-09-26, accepted screen L1: "a
 *  compact player row, then the question and five taller answer buttons").
 *  Stacked full-width answers with no icons and no "Other" divider: the
 *  answers are the main thing on the screen. The two secondary answers stay
 *  distinct stored values, side by side under the three. The blind-rater
 *  lanes keep the grid above. */
function OwnerAnswers({
  options,
  selected,
  disabled,
  onPick,
}: {
  options: RatingOption[];
  selected: ConfidenceRatingValue | null;
  disabled: boolean;
  onPick: (value: ConfidenceRatingValue) => void;
}) {
  const answer = (option: RatingOption, extra: string) => {
    const active = selected === option.value;
    return (
      <button
        key={option.value}
        type="button"
        aria-pressed={active}
        disabled={disabled}
        onClick={() => onPick(option.value)}
        className={`flex items-center justify-center rounded-full border px-4 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${extra} ${
          active
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-background text-foreground hover:border-foreground/50 hover:bg-muted/40"
        }`}
      >
        {option.label}
      </button>
    );
  };
  return (
    <div data-owner-answers className="mt-3 flex flex-col gap-2">
      {options.map((option) =>
        answer(option, "min-h-14 text-[15px] font-semibold"),
      )}
      <div className="grid grid-cols-2 gap-2">
        {SECONDARY_RATING_OPTIONS.map((option) =>
          answer(option, "min-h-12 text-sm font-medium"),
        )}
      </div>
    </div>
  );
}
