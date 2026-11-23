"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { TypingGlyph } from "../../TypingDots";
import { TapRow } from "../../WillQuestion";
import { W } from "./hostSetupCopy";
import ChatComposer from "../ChatComposer";
import OneTopBar, { useBarBack } from "../../OneTopBar";
import { TopBar } from "../TopBar";

/* -------------------------------------------------------------------------- */
/*  The blank setup's pieces, as the locked prototype draws them: Will's top  */
/*  bar, his line, one's own line, a card, the chips, Keep and Change, the    */
/*  box that grows with its text, and the three dots while Will works.       */
/* -------------------------------------------------------------------------- */

export function WillDots() {
  return (
    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center gap-[3px] rounded-full bg-foreground">
      {[0, 1, 2].map((i) => (
        <i key={i} className="block h-[5px] w-[5px] rounded-full bg-background" />
      ))}
    </span>
  );
}

/** What the one bar says on every screen of this surface ("Your chat" for
 *  the setup and its parts); null: the arrow alone (N639). */
export const FrameTitle = createContext<ReactNode>(null);

/** The setup read as a chat (backend N647 item 9): the steps answered so far,
 *  drawn above the screen on show; null where a screen stands alone. */
export const FrameHistory = createContext<ReactNode>(null);

/** Will's line under the screen on show when a save failed (backend N649
 *  item 1); null otherwise. */
export const FrameNote = createContext<ReactNode>(null);

/** The chats' own top bar, in place of the one bar, on the setup (the host's
 *  chat). Null everywhere else that opens from Will's lines. */
export const FrameBar = createContext<((onBack?: () => void) => ReactNode) | null>(null);

/** The shared bottom bar: tap-to-choose answers, then the chat's composer.
 *  A screen passes its own; otherwise the setup's default (the composer).
 *  `null` on a screen that already has its own box. */
export type SetupDockSpec = {
  choices?: string[];
  onChoice?: (label: string) => void;
  onSend: (text: string) => void | boolean;
  placeholder?: string;
  lines?: boolean;
  disabled?: boolean;
  initial?: string;
};
export const FrameDock = createContext<SetupDockSpec | null>(null);

/** The row that opened this chat, drawn as the first bubble. */
export const FrameLead = createContext<ReactNode>(null);

/** Two big taps, then the composer. One or two choices fill the bar; the
 *  last one is the one that keeps. */
function BigChoices({ labels, onChoice, disabled }: { labels: string[]; onChoice: (label: string) => void; disabled?: boolean }) {
  return (
    <div data-setup-dock-choices="" className="flex gap-2 px-2 pt-2">
      {labels.map((label, i) => (
        <button
          key={label}
          type="button"
          disabled={disabled}
          onClick={() => onChoice(label)}
          className={`min-h-12 flex-1 rounded-full px-3 text-[16px] font-semibold disabled:opacity-40 ${
            i === labels.length - 1 && labels.length > 1 ? "bg-foreground text-background" : "border-[1.5px] border-border bg-background text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** One item with exactly two taps (On/Off, Keep/Remove). */
export function BinaryRow({ title, sub, on, onLabel, offLabel, onPick }: {
  title: string;
  sub?: string;
  on: boolean;
  onLabel: string;
  offLabel: string;
  onPick: (on: boolean) => void;
}) {
  const one = (label: string, chosen: boolean, pick: boolean) => (
    <button
      type="button"
      data-choice={pick ? "on" : "off"}
      aria-pressed={chosen}
      onClick={() => onPick(pick)}
      className={`min-h-11 flex-1 rounded-full px-3 text-[15px] font-semibold ${chosen ? "bg-foreground text-background" : "border-[1.5px] border-border bg-background text-foreground"}`}
    >
      {label}
    </button>
  );
  return (
    <div data-binary="" className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-border px-3.5 py-3">
      <b className="text-[16px] font-semibold text-foreground">{title}</b>
      {sub ? <span className="text-[16px] text-foreground">{sub}</span> : null}
      <div className="flex gap-2">
        {one(offLabel, !on, false)}
        {one(onLabel, on, true)}
      </div>
    </div>
  );
}

/** One bar for every setup screen: two big taps when the step has a pair,
 *  then the chat's composer, always open. */
export function SetupDock({ choices, onChoice, onSend, placeholder, lines, disabled, initial }: SetupDockSpec) {
  const pair = choices && choices.length > 0 && choices.length <= 2 && onChoice;
  return (
    <div data-setup-dock="" className="shrink-0 bg-background">
      {pair ? <BigChoices labels={choices} onChoice={onChoice} disabled={disabled} /> : choices?.length && onChoice ? (
        <div className="px-2 pt-2">
          <TapRow even={false} disabled={disabled} labels={choices} onTap={onChoice} dataAttr={{ "data-setup-dock-choices": "" }} />
        </div>
      ) : null}
      <Box key={`${placeholder ?? ""}:${initial ?? ""}`} placeholder={placeholder ?? W.typeHere} onSend={onSend} lines={lines} initial={initial} />
    </div>
  );
}

/** One screen: its top bar, Will's lines, and what to tap at the foot. The
 *  bar is the one bar (N639): the back arrow and the surface's name. With a
 *  `circle`, a chat's own bar instead ("Test my chat": back, the circle and
 *  the name), as a chat keeps. */
export function Frame({ title, onBack, circle, foot, bar = null, dock, children }: {
  /** A bar of its own in place of the header (Live's, backend N642 item 3). */
  bar?: ReactNode;
  title?: ReactNode;
  onBack?: () => void;
  circle?: ReactNode;
  foot?: ReactNode;
  /** The shared bottom bar. Omit to use the setup's default; null to draw none. */
  dock?: SetupDockSpec | null;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement | null>(null);
  const named = useContext(FrameTitle);
  const history = useContext(FrameHistory);
  const note = useContext(FrameNote);
  const makeBar = useContext(FrameBar);
  const dockFallback = useContext(FrameDock);
  const dockSpec = dock === null ? null : dock ?? dockFallback;
  const lead = useContext(FrameLead);
  useBarBack(onBack);
  useEffect(() => {
    const el = body.current;
    if (el) el.scrollTop = el.scrollHeight;
  });
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {bar ? (
        bar
      ) : circle ? (
        <TopBar circle={circle} title={typeof title === "string" ? title : W.will} onBack={onBack ?? (() => undefined)} />
      ) : (
        makeBar ? makeBar(onBack) : <OneTopBar onBack={onBack} title={title ?? named} />
      )}
      <div ref={body} className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-4 py-4 [&>:first-child]:mt-auto">
        {lead}
        {history}
        {children}
        {note}
      </div>
      {dockSpec ? <SetupDock {...dockSpec} /> : foot ? <div data-host-foot="" className="bar-space flex flex-col gap-2 border-t border-border">{foot}</div> : null}
    </div>
  );
}

export function Say({ children, by }: { children: ReactNode; by?: string }) {
  return (
    <>
      <div data-will-line="" className="max-w-[86%] min-w-0 self-start whitespace-pre-wrap break-words rounded-2xl bg-muted px-3.5 py-2.5 text-[16px] leading-snug text-foreground">
        {children}
      </div>
      {by ? (
        <p data-line-by="" className="-mt-1.5 flex items-center gap-1.5 self-start text-[13px] text-muted-foreground">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#2F9E6E]" />
          {by}
        </p>
      ) : null}
    </>
  );
}

export function Mine({ children }: { children: ReactNode }) {
  return (
    <div data-my-line="" className="max-w-[86%] self-end whitespace-pre-wrap rounded-2xl bg-primary px-3.5 py-2.5 text-[16px] leading-snug text-primary-foreground">
      {children}
    </div>
  );
}

/** A line that explains a screen: one of Will's lines, the same size as the
 *  rest, never small grey letters (N637 item 1). */
export function Cap({ children }: { children: ReactNode }) {
  return <Say>{children}</Say>;
}

export function Card({ b, s, children }: { b?: ReactNode; s?: ReactNode; children?: ReactNode }) {
  return (
    <div data-setup-card="" className="flex flex-col gap-1 rounded-2xl border border-border px-3.5 py-3">
      {b ? <b className="text-[16px] font-semibold text-foreground">{b}</b> : null}
      {s ? <span className="text-[16px] text-foreground">{s}</span> : null}
      {children}
    </div>
  );
}

export function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((x, i) => (
        <span key={`${i}-${x}`} data-chip="" className="rounded-full border border-border px-3 py-1.5 text-[15px] text-foreground">
          {x}
        </span>
      ))}
    </div>
  );
}

const BTN = "min-h-[48px] flex-1 rounded-full px-4 text-[16px] font-semibold disabled:opacity-40";
export function Btn({ label, onClick, out = false, disabled = false }: { label: string; onClick: () => void; out?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${BTN} ${out ? "border-[1.5px] border-border bg-background text-foreground" : "bg-foreground text-background"}`}
    >
      {label}
    </button>
  );
}

export function Two({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <div className="flex gap-2">{left}{right}</div>;
}

export function Link({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-[40px] self-center text-[15px] font-medium text-foreground underline underline-offset-2">
      {label}
    </button>
  );
}

/** A choice to tap: its title and, under it, what follows. */
export function Opt({ title, sub, on = false, tick, disabled = false, onClick, badge, under }: {
  title: string;
  sub?: string;
  /** A line right under the badge. */
  under?: string;
  on?: boolean;
  tick?: boolean;
  disabled?: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...(tick === undefined ? {} : { role: "checkbox", "aria-checked": tick })}
      className={`flex items-start gap-3 rounded-2xl border-[1.5px] px-3.5 py-3 text-left disabled:opacity-45 ${on || tick ? "border-foreground" : "border-border"}`}
    >
      {tick === undefined ? null : (
        <i aria-hidden className={`mt-0.5 block h-5 w-5 shrink-0 rounded-md border-[1.5px] ${tick ? "border-foreground bg-foreground" : "border-border"}`} />
      )}
      <span className="flex flex-col gap-0.5">
        {badge ? <span className="self-start rounded-full bg-[#E2F4EB] dark:bg-[#12271d] px-2 py-0.5 text-[12px] font-semibold text-[#2F9E6E]">{badge}</span> : null}
        {under ? <span className="text-[16px] text-foreground">{under}</span> : null}
        <b className="text-[16px] font-semibold text-foreground">{title}</b>
        {sub ? <span className="text-[16px] text-foreground">{sub}</span> : null}
      </span>
    </button>
  );
}

export function Dots() {
  return (
    <div role="status" aria-label={W.thinking} data-will-thinking="" className="self-start rounded-2xl bg-muted px-4 py-3.5">
      <TypingGlyph />
    </div>
  );
}

/** The builder's typed setup uses the shared composer. */
export function Box({ placeholder, onSend, initial = "", lines = false, busy }: {
  placeholder: string;
  onSend: (text: string) => void | boolean | Promise<void | boolean>;
  initial?: string;
  /** For fields with one item per line, Enter inserts a line break. */
  lines?: boolean;
  busy?: boolean;
}) {
  return (
    <ChatComposer
      placeholder={placeholder}
      initialValue={initial}
      autoFocus
      maxLength={400}
      newlines={lines}
      busy={busy}
      onSend={(words) => onSend(words.trim())}
      formAttrs={{ "data-host-box": "" }}
    />
  );
}
