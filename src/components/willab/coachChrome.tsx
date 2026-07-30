"use client";

import type { ReactNode } from "react";

/* -------------------------------------------------------------------------- */
/*  coachChrome — the presentational vocabulary BOTH coach lanes share          */
/*                                                                            */
/*  There are two coach feedback lanes, and they stay separate SURFACES        */
/*  (N1 / BLIND COACH, enforced by starVerdictSeparation.test.ts):             */
/*    - the BLIND labeler   CoachReviewOverlay → CoachSnippetReviewCard        */
/*    - the STAR verdicts   CoachStarVerdictOverlay                            */
/*                                                                            */
/*  Separate surfaces, not separate design languages. Both lanes were drawing  */
/*  the same pill, badge, eyebrow, error line and card from scratch. The star  */
/*  lane's local VerdictPill even carried a comment saying it copied the       */
/*  labeler's chip idiom "plus aria-pressed" — which is exactly how the        */
/*  labeler ended up the only one of the two WITHOUT aria-pressed. Copying a   */
/*  chip by hand loses whichever detail the copier did not notice.             */
/*                                                                            */
/*  THIS FILE IS NOT A BRIDGE. It imports from neither lane, and it holds no   */
/*  vocabulary belonging to either one: no direction labels, no star families,  */
/*  no devices, no verdicts. Shared CHROME only. If a machine guess could      */
/*  reach the blind flow through a shared module, the fence would be worth     */
/*  nothing, so the separation test asserts this file imports neither lane.     */
/*                                                                            */
/*  Founder decision 2026-07-30: "unify the plumbing, keep the surfaces        */
/*  separate." The moment something lane-specific lands in here, that decision */
/*  has been quietly reversed — put it in the lane that owns it instead.       */
/* -------------------------------------------------------------------------- */

/** The selectable pill both lanes use for a single-select control: the
 *  labeler's Direction chips, the star lane's Keep / Wrong kind / Shouldn't
 *  fire, and the wrong-kind correction options. */
export function CoachChip({
  active,
  onClick,
  children,
  disabled = false,
  size = "md",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  /** "md" is a primary three-way control. "sm" is a secondary row nested
   *  inside an already-open control (the wrong-kind correction options). */
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      // Both lanes are single-select, so the chosen chip has to reach a screen
      // reader AS pressed — colour alone is not the state.
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border transition-colors disabled:opacity-50 ${
        size === "sm" ? "px-3 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]"
      } ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}

/** Tones for the static metadata badge. Deliberately named for WEIGHT, not for
 *  meaning: "warn" is a nudge, not a severity, and neither lane may encode a
 *  score or a verdict in a colour (AC-9). */
export type CoachMetaTone = "muted" | "outline" | "accent" | "warn";

const META_TONE: Record<CoachMetaTone, string> = {
  muted: "bg-muted font-medium text-muted-foreground",
  outline: "border border-border text-muted-foreground",
  accent: "bg-primary/10 font-medium text-primary",
  warn: "bg-amber-500/15 font-medium text-amber-700 dark:text-amber-300",
};

/** A read-only badge: the take number, the recording kind, the star family,
 *  the edited nudge. Never interactive — if it can be tapped it is a
 *  CoachChip. */
export function CoachMetaPill({
  tone = "muted",
  children,
}: {
  tone?: CoachMetaTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${META_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

/** The audience label that sits beside a section heading: "Private · training",
 *  "Shown to user", "Coach only · training", "Suggested".
 *
 *  This is the one piece of shared chrome that carries real weight. Every
 *  control on a coach surface belongs to exactly one audience, and this label
 *  is how the coach knows which. Both lanes had drifted to slightly different
 *  type for the same job. */
export function CoachEyebrow({
  children,
  className = "",
  strong = false,
}: {
  children: ReactNode;
  /** Spacing only (`ml-2`, `mr-2`, `shrink-0`) — the type is fixed here. */
  className?: string;
  strong?: boolean;
}) {
  return (
    <span
      className={`text-[11px] uppercase tracking-wide text-muted-foreground ${
        strong ? "font-medium" : "font-normal"
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** A save failure, in the one voice both lanes use. `inline` for the labeler's
 *  status footer (it trails other text in a row); block otherwise. */
export function CoachErrorLine({
  children,
  inline = false,
  className = "",
}: {
  children: ReactNode;
  inline?: boolean;
  className?: string;
}) {
  const cls = `text-[12px] text-destructive ${className}`;
  return inline ? (
    <span className={cls}>{children}</span>
  ) : (
    <p className={cls}>{children}</p>
  );
}

/** The card shell: one snippet in the labeler, one star row in the verdict
 *  lane. `as="li"` because the star lane renders a real list. */
export function CoachCard({
  children,
  gap = "md",
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  /** "lg" is the labeler card's roomier rhythm (it stacks slide + readout +
   *  controls); "md" is the star row. */
  gap?: "md" | "lg";
  as?: "div" | "li";
  className?: string;
}) {
  return (
    <Tag
      className={`flex flex-col rounded-2xl border border-border bg-card p-4 ${
        gap === "lg" ? "gap-5" : "gap-3"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
