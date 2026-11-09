"use client";

import { useRef, type ReactNode } from "react";
import { Check } from "lucide-react";
import type { SetupChoice, SetupScreen } from "@/services/api/modelSetup";
import { cn } from "@/lib/utils";
import { MODELS_WORDS as W } from "./modelsCopy";

/* -------------------------------------------------------------------------- */
/*  The small parts the setup's screens share, drawn as the locked prototype  */
/*  draws them (backend docs/design/model-launchpad-2026-11-09/, version 8:   */
/*  its choice, x-chapters, x-prog, x-field, x-input, x-scale, x-file,       */
/*  x-usage, x-hist, x-check, x-locked). Every word they show arrives in the  */
/*  setup's `screen` (services/model_setup.py): none of their own.           */
/* -------------------------------------------------------------------------- */

/** The chapters and the thin bar under the top bar (MOD-24): where the owner
 *  is in the setup, not a score. "Optional" sits beside the chapters. */
export function Chapters({ screen }: { screen: SetupScreen }) {
  return (
    <div data-setup-chapters className="flex flex-col">
      <div className="flex items-center gap-1.5 px-5 pt-0.5">
        {screen.chapters.map((c, i) => (
          <span key={c.name} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden className="text-[12px] text-muted-foreground">·</span> : null}
            <i data-on={c.on || undefined} className={cn("text-[12px] font-semibold not-italic", c.on ? "text-foreground" : "text-muted-foreground")}>
              {c.name}
            </i>
          </span>
        ))}
        {screen.optional ? (
          <span data-setup-optional className="ml-1 rounded-full bg-muted px-2 py-px text-[11.5px] font-semibold text-muted-foreground">
            {screen.optional}
          </span>
        ) : null}
      </div>
      <div aria-hidden className="mx-5 mt-1.5 h-[3px] overflow-hidden rounded-full bg-muted">
        <span data-setup-bar={screen.bar} className="block h-full rounded-full bg-foreground" style={{ width: `${screen.bar}%` }} />
      </div>
    </div>
  );
}

/** Will's line, the prototype's bubble. */
export function Said({ children }: { children: ReactNode }) {
  return (
    <div data-setup-line className="flex max-w-[94%] items-end text-[18.5px] leading-[1.45] text-foreground">
      <div className="flex min-w-0 flex-col rounded-[22px] bg-muted px-[17px] py-[13px]">{children}</div>
    </div>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[14px] text-muted-foreground">{children}</p>;
}

function Box({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] border-[1.5px] text-background",
        on ? "border-foreground bg-foreground" : "border-foreground/35",
      )}
    >
      {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
    </span>
  );
}

/** One choice: a tick box when it has `check`, a dark border when `on`,
 *  faded with its tag ("Soon") when it cannot be chosen yet. */
export function Choice({ choice, check, on, onClick }: {
  choice: SetupChoice;
  /** Overrides the screen's tick (the owner's tap, before it is saved). */
  check?: boolean;
  on?: boolean;
  onClick?: () => void;
}) {
  const ticked = check ?? choice.check;
  const ticks = ticked !== undefined;
  const dark = on ?? choice.on;
  return (
    <button
      type="button"
      data-setup-choice={choice.key}
      role={ticks ? "checkbox" : undefined}
      aria-checked={ticks ? Boolean(ticked) : undefined}
      aria-pressed={!ticks && onClick ? Boolean(dark) : undefined}
      disabled={!onClick || choice.faded}
      onClick={onClick}
      className={cn(
        "walk-press flex w-full items-center gap-3 rounded-2xl border-[1.5px] bg-background px-3.5 py-[13px] text-left disabled:cursor-default",
        dark ? "border-foreground" : "border-border",
        choice.faded && "opacity-45",
      )}
    >
      {ticks ? <Box on={Boolean(ticked)} /> : null}
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] font-semibold text-foreground">{choice.title}</b>
        {choice.line ? <small className="mt-px block text-[13.5px] text-muted-foreground">{choice.line}</small> : null}
      </span>
      {choice.tag ? <span className="rounded-full bg-muted px-[9px] py-0.5 text-[12px] font-bold text-muted-foreground">{choice.tag}</span> : null}
    </button>
  );
}

/** The prototype's x-field: one of Describe's three answers. */
export function Field({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  return (
    <textarea
      rows={4}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-[110px] w-full rounded-2xl border-[1.5px] border-foreground bg-background px-3.5 py-3 text-[16px] leading-[1.5] outline-none"
    />
  );
}

/** The prototype's x-input. */
export function Input({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  return (
    <input
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-[14px] border-[1.5px] border-border bg-background px-3 py-2.5 text-[16px] outline-none focus:border-foreground"
    />
  );
}

/** The dashed file row: the file's name once read, else "Upload a file"
 *  (backend WORDS add_upload) to choose one. */
export function FileRow({ name, accept, onFile }: { name: string | null; accept: string; onFile: (file: File) => void }) {
  const pick = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        data-setup-file
        onClick={() => pick.current?.click()}
        className="rounded-[14px] border-[1.5px] border-dashed border-border px-3.5 py-3 text-left text-[14.5px]"
      >
        {name || W.add_upload}
      </button>
      <input
        ref={pick}
        type="file"
        accept={accept}
        hidden
        data-setup-file-input
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}

/** The prototype's x-usage: a label and its value per row. */
export function Rows({ rows }: { rows: [string, string | number][] }) {
  return (
    <dl className="m-0 flex flex-col gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 border-b border-border pb-2 text-[15px]">
          <dt className="max-w-[45%] flex-none text-muted-foreground">{label}</dt>
          <dd className="m-0 min-w-0 text-right font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** How the scores spread, one bar per point (the prototype's x-hist). */
export function Hist({ hist }: { hist: { point: number; n: number }[] }) {
  const most = Math.max(1, ...hist.map((h) => h.n));
  return (
    <div data-setup-hist className="flex h-[86px] items-end gap-2 px-0.5 pt-1">
      {hist.map((h) => (
        <span key={h.point} className="flex flex-1 flex-col items-center justify-end gap-1">
          <i className="block w-full max-w-[40px] rounded-[6px_6px_2px_2px] bg-foreground" style={{ height: `${Math.round((h.n / most) * 64)}px` }} />
          <b className="text-[12px] font-semibold text-muted-foreground">{h.point}</b>
        </span>
      ))}
    </div>
  );
}

/** "To finish setting it up": each part, done or not; a tap opens its step. */
export function Checklist({ list, onOpen }: { list: { title: string; items: { title: string; step: string; done: boolean }[] }; onOpen: (step: string) => void }) {
  return (
    <div data-setup-checklist className="flex flex-col gap-0.5 rounded-2xl border-[1.5px] border-border px-3.5 py-2.5">
      <b className="mb-1 text-[15px]">{list.title}</b>
      {list.items.map((item) => (
        <button
          key={item.step}
          type="button"
          data-done={item.done || undefined}
          onClick={() => onOpen(item.step)}
          className="flex items-center gap-2.5 py-1.5 text-left text-[15px] text-foreground"
        >
          <i
            aria-hidden
            className={cn(
              "h-5 w-5 flex-none rounded-[6px] border-[1.5px]",
              item.done ? "border-foreground bg-foreground shadow-[inset_0_0_0_4px_hsl(var(--background))]" : "border-foreground/35",
            )}
          />
          <span className={cn(item.done && "text-muted-foreground line-through")}>{item.title}</span>
        </button>
      ))}
    </div>
  );
}

/** "Sell it through an API", locked until a training beats today's version. */
export function Locked({ locked }: { locked: { title: string; lines: string[] } }) {
  return (
    <div data-setup-locked className="flex flex-col gap-1 rounded-2xl bg-muted px-3.5 py-3 text-[14.5px]">
      <b>{locked.title}</b>
      <span>{locked.lines.join(" ")}</span>
    </div>
  );
}
