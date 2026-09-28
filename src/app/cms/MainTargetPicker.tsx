"use client";

/* -------------------------------------------------------------------------- */
/*  An exercise's ONE main target (backend 2026-09-28, D5/D5a).               */
/*                                                                            */
/*  Picked from the tags the author already selected. Every other tag becomes */
/*  a secondary target, which can only ever serve the exercise as a trial     */
/*  when nothing else fits. Optional: with none named, every tag stays a main */
/*  target, which is how exercises behave today. The backend refuses a main  */
/*  target the exercise does not itself claim, so only its own tags are       */
/*  offered here. Author-facing only; nothing here reaches a speaker.         */
/*                                                                            */
/*  Wording is new and held for founder sign-off.                             */
/* -------------------------------------------------------------------------- */

export const MAIN_TARGET_COPY = {
  heading: "Main target (optional)",
  none: "None",
  help: "The one problem this exercise is written for. It treats the others only when nothing else fits.",
} as const;

/** A main target that is no longer among the tags is dropped. */
export function keptMainTarget(tags: readonly string[], primary: string | null): string | null {
  return primary && tags.includes(primary) ? primary : null;
}

export default function MainTargetPicker({
  tags,
  labels,
  value,
  onChange,
  size = "sm",
}: {
  /** The tags the author selected, in their order. */
  tags: readonly string[];
  labels: ReadonlyMap<string, string>;
  value: string | null;
  onChange: (next: string | null) => void;
  size?: "sm" | "lg";
}) {
  if (tags.length < 2) return null;
  const chip = size === "lg" ? "px-4 py-3 text-[14px]" : "px-3 py-1.5 text-[12px] font-normal";
  const options: [string | null, string][] = [
    [null, MAIN_TARGET_COPY.none],
    ...tags.map((tag) => [tag, labels.get(tag) ?? tag] as [string, string]),
  ];
  return (
    <div className="mt-4" data-testid="main-target-picker">
      <p className={size === "lg" ? "text-[14px] font-medium text-foreground" : "text-xs font-medium text-foreground"}>
        {MAIN_TARGET_COPY.heading}
      </p>
      <div role="radiogroup" aria-label={MAIN_TARGET_COPY.heading} className="mt-2 flex flex-wrap gap-2">
        {options.map(([tag, label]) => {
          const on = keptMainTarget(tags, value) === tag;
          return (
            <button
              key={tag ?? "none"}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(tag)}
              className={`rounded-full border ${chip} ${
                on
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] font-normal text-muted-foreground">{MAIN_TARGET_COPY.help}</p>
    </div>
  );
}
