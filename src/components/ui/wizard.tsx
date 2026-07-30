"use client";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  wizard — the shared onboarding chrome (founder 2026-07-27)                 */
/*                                                                            */
/*  The recording setup and the Life Panel setup are the product's two         */
/*  onboarding flows, and they looked like two different products: one had an  */
/*  eyebrow + question head with a dot row and a full-width rounded CTA, the   */
/*  other had a heading with small pill buttons at the bottom. The founder     */
/*  asked the panel to follow the recording flow, so the chrome lives here and */
/*  BOTH mount it. One module, two mounts, not a copy — a copy is how the two  */
/*  drifted in the first place and is what would let them drift again.         */
/*                                                                            */
/*  Chrome only. Neither flow's steps, validation or save behaviour lives      */
/*  here; they have nothing in common and should not.                          */
/* -------------------------------------------------------------------------- */

/** One question per screen: a small eyebrow, the question, an optional helper. */
export function StepHead({
  eyebrow,
  question,
  helper,
}: {
  eyebrow: string;
  question: string;
  helper?: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 text-[22px] font-semibold leading-snug text-foreground">
        {question}
      </h2>
      {helper ? (
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

/** Back · the step dots · a trailing slot.
 *
 *  The two side slots are a FIXED width and mirror each other, so the dots stay
 *  optically centred whether or not either side is filled — and so nothing in
 *  the trailing slot (a ✕, say) can overlap the dots at any breakpoint. */
export function WizardProgress({
  count,
  current,
  onBack,
  trailing,
  showBack = true,
}: {
  count: number;
  current: number;
  /** Omitted, or on the first step → the slot renders empty, not a dead button. */
  onBack?: () => void;
  trailing?: React.ReactNode;
  /** Founder 2026-07-30 — the panel's setup moved Back to the BOTTOM bar,
   *  next to Next. `showBack={false}` empties this row's slot for that flow
   *  while keeping the fixed-width spacer, so the dots stay centred and the
   *  other consumer (RecordingSetup) is untouched by default. */
  showBack?: boolean;
}) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="w-16">
        {showBack && onBack && current > 0 ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-8 items-center rounded-full px-2 text-[13px] text-muted-foreground transition hover:text-foreground"
          >
            ← Back
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 items-center justify-center gap-1.5">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={cn(
              "rounded-full transition-all",
              // The current step is taller AND longer, so "which step am I on"
              // reads at a glance rather than by comparing widths.
              i === current
                ? "h-2 w-6 bg-foreground"
                : i < current
                  ? "h-1.5 w-1.5 bg-foreground/40"
                  : "h-1.5 w-1.5 bg-muted-foreground/20"
            )}
          />
        ))}
      </div>
      <div className="flex w-16 justify-end">{trailing}</div>
    </div>
  );
}

/** A tappable preset. The neutral foreground when selected — orange stays
 *  reserved for live-action signals, so a chosen chip must not borrow it.
 *
 *  Two sizes, one component: "md" is a step's own answer (the recording flow's
 *  length presets), "sm" sits inside a denser card as one field's shortcut
 *  (the panel's due labels). Sharing the component rather than the classes is
 *  what stops the selected state drifting between them. */
export function WizardChip({
  active,
  onClick,
  size = "md",
  children,
}: {
  active: boolean;
  onClick: () => void;
  size?: "sm" | "md";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border transition active:scale-[0.98]",
        size === "md" ? "h-10 px-4 text-[14px]" : "h-7 px-2.5 text-xs",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-foreground hover:border-foreground/40"
      )}
    >
      {children}
    </button>
  );
}
