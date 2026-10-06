"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  WalkOptions — several ticks may be on; an exclusive one stands alone       */
/*  (founder lock 2026-10-06, sharing: "None" stands alone). A ticked option   */
/*  with fields shows them, rising in.                                        */
/* -------------------------------------------------------------------------- */

export type WalkOption = {
  value: string;
  label: string;
  hint?: string;
  /** Ticking it clears every other; ticking another clears it. */
  exclusive?: boolean;
  /** Shown under the option while it is ticked (a pass code, a name). */
  fields?: ReactNode;
};

/** Pure: the ticks after tapping `value`. */
export function toggleWalkOption(
  selected: readonly string[],
  value: string,
  options: readonly Pick<WalkOption, "value" | "exclusive">[],
): string[] {
  if (selected.includes(value)) return selected.filter((v) => v !== value);
  const exclusive = new Set(options.filter((o) => o.exclusive).map((o) => o.value));
  if (exclusive.has(value)) return [value];
  return [...selected.filter((v) => !exclusive.has(v)), value];
}

function Row({ option, on, onTap }: { option: WalkOption; on: boolean; onTap: () => void }) {
  return (
    <div
      data-walk-option={option.value}
      className={cn(
        "walk-fill flex w-full flex-col gap-2 rounded-2xl border-[1.5px] px-3.5 py-3",
        on ? "border-foreground" : "border-border",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        onClick={onTap}
        className="walk-press flex w-full items-start gap-3 text-left"
      >
        <span
          aria-hidden="true"
          className={cn(
            "walk-fill mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] border-[1.5px] text-background",
            on ? "border-foreground bg-foreground" : "border-foreground/35",
          )}
        >
          {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
        </span>
        <span className="min-w-0">
          <b className="block text-[16px] font-semibold">{option.label}</b>
          {option.hint ? <small className="mt-px block text-[13.5px] text-muted-foreground">{option.hint}</small> : null}
        </span>
      </button>
      {on && option.fields ? <div className="walk-rise flex gap-2 pl-[34px]">{option.fields}</div> : null}
    </div>
  );
}

export default function WalkOptions({
  options,
  selected,
  onChange,
}: {
  options: readonly WalkOption[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div data-walk-options role="group" className="flex flex-col gap-2">
      {options.map((option) => (
        <Row
          key={option.value}
          option={option}
          on={selected.includes(option.value)}
          onTap={() => onChange(toggleWalkOption(selected, option.value, options))}
        />
      ))}
    </div>
  );
}

/** The plain field inside an option. */
export function WalkField({ placeholder }: { placeholder: string }) {
  return (
    <input
      aria-label={placeholder}
      placeholder={placeholder}
      className="w-full min-w-0 rounded-[10px] border border-border bg-background px-2.5 py-2 text-[14.5px] outline-none focus:border-foreground"
    />
  );
}
