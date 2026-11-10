"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TypingGlyph } from "../../TypingDots";
import { W } from "./hostSetupCopy";

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

export function Frame({ title = W.will, onBack, circle = <WillDots />, foot, children }: {
  title?: ReactNode;
  onBack?: () => void;
  circle?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = body.current;
    if (el) el.scrollTop = el.scrollHeight;
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-[56px] items-center gap-2.5 border-b border-border px-3">
        {onBack ? (
          <button type="button" data-host-back="" onClick={onBack} className="min-h-[44px] pr-1 text-[16px] font-medium text-foreground">
            {W.back}
          </button>
        ) : null}
        {circle}
        <b className="text-[17px] font-semibold text-foreground">{title}</b>
      </div>
      <div ref={body} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
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

export function Cap({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[14px] leading-snug text-muted-foreground">{children}</p>;
}

export function Card({ b, s, children }: { b?: ReactNode; s?: ReactNode; children?: ReactNode }) {
  return (
    <div data-setup-card="" className="flex flex-col gap-1 rounded-2xl border border-border px-3.5 py-3">
      {b ? <b className="text-[16px] font-semibold text-foreground">{b}</b> : null}
      {s ? <small className="text-[14px] text-muted-foreground">{s}</small> : null}
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
        {under ? <small className="text-[13.5px] text-muted-foreground">{under}</small> : null}
        <b className="text-[16px] font-semibold text-foreground">{title}</b>
        {sub ? <small className="text-[13.5px] text-muted-foreground">{sub}</small> : null}
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

/** The box: it grows with its text up to seven lines (N618 item 4); Enter
 *  sends, Shift+Enter is a new line. */
export function Box({ placeholder, onSend, before, after, initial = "" }: {
  placeholder: string;
  onSend: (text: string) => void;
  before?: ReactNode;
  after?: ReactNode;
  /** Already in the box, to send as it is or change. */
  initial?: string;
}) {
  const [text, setText] = useState(initial);
  const ta = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);
  const send = () => {
    const v = text.trim();
    if (!v) return;
    setText("");
    onSend(v);
  };
  return (
    <form
      data-host-box=""
      className="flex items-end gap-2 border-t border-border px-3 py-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      {before}
      <textarea
        ref={ta}
        rows={1}
        maxLength={400}
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        className="min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-background px-3.5 py-2.5 text-[16px] leading-snug outline-none"
      />
      <button type="submit" className="min-h-[44px] rounded-full bg-foreground px-4 text-[15px] font-semibold text-background">
        {W.send}
      </button>
      {after}
    </form>
  );
}
