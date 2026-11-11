"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { TypingGlyph } from "../../TypingDots";
import { W } from "./hostSetupCopy";
import { BarBox } from "../ChatBar";
import OneTopBar, { useBarBack } from "../../OneTopBar";

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

/** One screen: its top bar, Will's lines, and what to tap at the foot. The
 *  bar is the one bar (N639): the back arrow and the surface's name. With a
 *  `circle`, a chat's own bar instead ("Test my chat": back, the circle and
 *  the name), as a chat keeps. */
export function Frame({ title, onBack, circle, foot, children }: {
  title?: ReactNode;
  onBack?: () => void;
  circle?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement | null>(null);
  const named = useContext(FrameTitle);
  const history = useContext(FrameHistory);
  useBarBack(onBack);
  useEffect(() => {
    const el = body.current;
    if (el) el.scrollTop = el.scrollHeight;
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {circle ? (
        <div className="flex min-h-[56px] items-center gap-2.5 border-b border-border px-3">
          {onBack ? (
            <button type="button" data-host-back="" onClick={onBack} className="min-h-[44px] pr-1 text-[16px] font-medium text-foreground">
              {W.back}
            </button>
          ) : null}
          {circle}
          <b className="text-[17px] font-semibold text-foreground">{title ?? W.will}</b>
        </div>
      ) : (
        <OneTopBar onBack={onBack} title={title ?? named} />
      )}
      <div ref={body} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {history}
        {children}
      </div>
      {foot ? <div data-host-foot="" className="flex flex-col gap-2 border-t border-border px-4 py-3">{foot}</div> : null}
    </div>
  );
}

export function Say({ children, by }: { children: ReactNode; by?: string }) {
  return (
    <>
      <div data-will-line="" className="max-w-[86%] self-start whitespace-pre-wrap rounded-2xl bg-muted px-3.5 py-2.5 text-[16px] leading-snug text-foreground">
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
        {badge ? <span className="self-start rounded-full bg-[#E2F4EB] px-2 py-0.5 text-[12px] font-semibold text-[#2F9E6E]">{badge}</span> : null}
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

/** Where the person types: the app's own bottom bar (backend N647 item 9;
 *  was a box of its own with a "Send" word): the chats' box, its send icon
 *  on the right once there are words, growing with its text up to seven
 *  lines (N618 item 4). */
export function Box({ placeholder, onSend, before, after, initial = "" }: {
  placeholder: string;
  onSend: (text: string) => void;
  before?: ReactNode;
  after?: ReactNode;
  /** Already in the box, to send as it is or change. */
  initial?: string;
}) {
  return (
    <div data-host-box="" data-chat-bar="" className="flex min-h-[60px] shrink-0 items-center gap-1 p-2">
      {before}
      <BarBox
        hint={placeholder}
        open
        grow
        initial={initial}
        onSend={async (words) => {
          onSend(words.trim());
          return true;
        }}
      />
      {after}
    </div>
  );
}
