"use client";

import type { ReactNode } from "react";
import { EXPERIMENTS_USE_MOCKS } from "@/services/api/experiments";

/** Shown while the experiment screens are the on-device sample, not the backend. */
export function SampleData() {
  if (!EXPERIMENTS_USE_MOCKS) return null;
  return <p data-sample-data="" className="m-0 text-[12px] font-medium text-muted-foreground">Sample data</p>;
}

/** The body under the builder's one top bar. Nothing here scrolls. */
export function Frame({ screen, kicker, title, children, foot, wide = false }: {
  screen: string;
  kicker?: string;
  title: string;
  children: ReactNode;
  foot?: ReactNode;
  wide?: boolean;
}) {
  const width = wide ? "max-w-5xl" : "max-w-3xl";
  return (
    <div data-experiments="" data-exp-screen={screen} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={`mx-auto flex min-h-0 w-full ${width} flex-1 flex-col justify-center gap-2 overflow-hidden px-6 py-3`}>
        <div className="flex flex-col gap-1">
          {kicker ? <p className="m-0 text-[13px] font-medium text-muted-foreground">{kicker}</p> : null}
          <p className="m-0 text-[22px] font-semibold leading-tight text-foreground">{title}</p>
          <SampleData />
        </div>
        {children}
      </div>
      {foot ? <div className={`mx-auto w-full ${width} shrink-0 px-6 pb-4`}>{foot}</div> : null}
    </div>
  );
}

export function ActionPair({ name, no, yes, onNo, onYes }: {
  name: string;
  no: string;
  yes: string;
  onNo: () => void;
  onYes: () => void;
}) {
  const one = (label: string, go: boolean, onClick: () => void) => (
    <button
      type="button"
      data-choice={go ? "yes" : "no"}
      onClick={onClick}
      className={`min-h-12 flex-1 rounded-full px-3 text-[16px] font-semibold ${go ? "bg-foreground text-background" : "border-[1.5px] border-border bg-background text-foreground"}`}
    >
      {label}
    </button>
  );
  return (
    <div data-pair={name} className="flex gap-2">
      {one(no, false, onNo)}
      {one(yes, true, onYes)}
    </div>
  );
}

export function ChoicePair({ name, options, value, onPick }: {
  name: string;
  options: { value: string; label: string }[];
  value?: string;
  onPick: (value: string) => void;
}) {
  return (
    <div data-pair={name} className="flex gap-2">
      {options.map((option) => {
        const on = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            data-choice={option.value}
            aria-pressed={on}
            onClick={() => onPick(option.value)}
            className={`min-h-12 flex-1 rounded-full px-3 text-[16px] font-semibold ${on ? "bg-foreground text-background" : "border-[1.5px] border-border bg-background text-foreground"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Note({ children }: { children: string }) {
  return <p className="m-0 text-[15px] leading-snug text-muted-foreground">{children}</p>;
}
