"use client";

import type { ProfileSex } from "@/services/api/userProfile";

/* -------------------------------------------------------------------------- */
/*  SpeakerSexQuestion — the ONE place the speaker-sex copy lives              */
/*                                                                            */
/*  Both surfaces that ask (SignupForm, SpeakerSexPrompt) render this, so the  */
/*  founder-signed-off wording exists exactly once. If you are about to        */
/*  duplicate these strings into a second component: don't. Import this.       */
/*  User-facing copy needs founder sign-off (LIVE LOOP); one copy of the       */
/*  string means one thing to re-sign when it changes.                        */
/*                                                                            */
/*  WHAT THIS IS NOT: not a demographics field, and not personalisation. The   */
/*  answer selects a weight vector inside the backend's voice-confidence       */
/*  composite (the DELIVERY term of the L2 ranking blend). One of its seven    */
/*  acoustic cues, pitch variability, reverses direction by speaker sex: a     */
/*  wide range reads as confident in women and unconfident in men. Per-speaker */
/*  normalisation does not absorb a sign flip, so without an answer one sex is */
/*  scored with that cue upside down.                                          */
/*                                                                            */
/*  The answer is NEVER surfaced back to the user: no badge, no insight, no    */
/*  readout line, and it never enters a number anyone sees (AC-9). The copy    */
/*  below deliberately says "calibrate", never "score" or "improve your        */
/*  rating", because it does not feed a score the user is shown.               */
/* -------------------------------------------------------------------------- */

/** Founder-signed-off 2026-07-29. Changing either string needs a new sign-off. */
export const SPEAKER_SEX_QUESTION = "How should we calibrate your voice?";
export const SPEAKER_SEX_EXPLAINER =
  "This tunes how we read your voice. Confident delivery sounds measurably " +
  "different in male and female voices, so we calibrate to the right one.";

/** Order is deliberate: the opt-out sits last, after the two routing answers. */
const OPTIONS: ReadonlyArray<{ value: ProfileSex; label: string }> = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export interface SpeakerSexQuestionProps {
  /** `null` renders as nothing selected, which is the correct initial state:
   *  the question is optional everywhere, so there is no default answer. */
  value: ProfileSex | null;
  onChange: (value: ProfileSex) => void;
  disabled?: boolean;
  /** Hide the explainer where the surrounding surface already carries it. */
  hideExplainer?: boolean;
  className?: string;
}

export default function SpeakerSexQuestion({
  value,
  onChange,
  disabled,
  hideExplainer,
  className,
}: SpeakerSexQuestionProps) {
  return (
    <fieldset className={className} disabled={disabled}>
      <legend className="mb-1 block text-sm font-medium">
        {SPEAKER_SEX_QUESTION}
      </legend>

      {!hideExplainer && (
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          {SPEAKER_SEX_EXPLAINER}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <label
              key={opt.value}
              className={[
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2",
                "text-sm transition-colors",
                selected
                  ? "border-primary bg-primary/5 font-medium"
                  : "border-border hover:bg-muted/40",
                disabled ? "cursor-not-allowed opacity-60" : "",
              ].join(" ")}
            >
              <input
                type="radio"
                // Unique per mount so two instances on one page (should that
                // ever happen) cannot share a radio group and fight.
                name="speaker-sex"
                value={opt.value}
                checked={selected}
                onChange={() => onChange(opt.value)}
                disabled={disabled}
                className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
