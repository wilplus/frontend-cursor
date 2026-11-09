"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MODELS_WORDS as W } from "./modelsCopy";
import { percentOf } from "./teachSteps";

/* -------------------------------------------------------------------------- */
/*  The small parts the AI models' screens share, drawn as the locked        */
/*  prototype draws them (backend docs/design/model-launchpad-2026-11-09/,   */
/*  version 8): its badges, the green bar, the cards, the mini buttons.      */
/* -------------------------------------------------------------------------- */

/** The prototype's three colours: green for public, gold for private and a
 *  draft, blue for ready to use. */
const BADGE = {
  ready: "bg-[#E3EEFB] text-[#1E4C99]",
  public: "bg-[#E2F4EB] text-[#2F9E6E]",
  private: "bg-[#F6EED8] text-[#7A5A12]",
} as const;

export function Badge({ text }: { text: string }) {
  const tone = text === W.filter_ready ? BADGE.ready : text === W.public ? BADGE.public : BADGE.private;
  return <span data-model-badge className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-bold", tone)}>{text}</span>;
}

/** The green bar, as far as the model's own line says; none when it says no
 *  share (a number about the model, never about a person: N526 item 3). */
export function Bar({ line }: { line: string }) {
  const pct = percentOf(line);
  if (pct === null) return null;
  return (
    <div aria-hidden className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <span className="block h-full rounded-full bg-[#2F9E6E]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Crown() {
  return (
    <span
      aria-hidden
      className="h-2.5 w-3.5 shrink-0 bg-[#E8A317]"
      style={{ clipPath: "polygon(0 100%, 0 20%, 25% 60%, 50% 0, 75% 60%, 100% 20%, 100% 100%)" }}
    />
  );
}

export function Mini({ label, quiet = false, onClick, disabled = false }: { label: string; quiet?: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      disabled={disabled || !onClick}
      className={cn(
        "rounded-full border-[1.5px] px-3.5 py-[7px] text-[14px] font-semibold disabled:cursor-default disabled:opacity-40",
        quiet ? "border-border bg-background text-foreground" : "border-foreground bg-foreground text-background",
      )}
    >
      {label}
    </button>
  );
}

export function Card({ children, draft = false, onOpen, testId }: { children: ReactNode; draft?: boolean; onOpen?: () => void; testId?: string }) {
  return (
    <div
      data-testid={testId}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (onOpen && (e.key === "Enter" || e.key === " ")) onOpen();
      }}
      className={cn("flex flex-col gap-1.5 rounded-[18px] border-[1.5px] border-border px-3.5 py-[13px]", draft && "border-dashed")}
    >
      {children}
    </div>
  );
}

/** The empty state: a soft green mark, its title, its line. */
export function Empty({ title, line }: { title: string; line: string }) {
  return (
    <div data-models-empty className="flex flex-col items-center gap-2 px-3 py-12 text-center">
      <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E2F4EB]">
        <span className="h-4 w-4 rounded-[4px] border-[2.5px] border-[#2F9E6E]" />
      </span>
      <b className="text-[19px]">{title}</b>
      <span className="max-w-[30ch] text-[15px] text-muted-foreground">{line}</span>
    </div>
  );
}

/** The example itself, as the teacher's screen receives it: a written case
 *  with its small label above, or a clip to play. Nothing else of it. */
export function ExampleCase({ content }: { content: Record<string, unknown> | null | undefined }) {
  const text = typeof content?.text === "string" ? content.text : null;
  const label = typeof content?.label === "string" ? content.label : null;
  const audio = typeof content?.audio_url === "string" ? content.audio_url : null;
  return (
    <>
      {audio ? <audio data-model-clip controls preload="none" src={audio} className="w-full" /> : null}
      {text ? (
        <div data-model-case className="rounded-[4px_14px_14px_4px] border-l-4 border-foreground bg-muted px-3.5 py-2.5">
          {label ? <small className="text-[12.5px] text-muted-foreground">{label}</small> : null}
          <p className="m-0 mt-0.5 text-[17px] leading-[1.45]">{text}</p>
        </div>
      ) : null}
    </>
  );
}
