"use client";

import { Children, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import Linkified from "./Linkified";
import { LEAVE_WORDS } from "@/lib/willab/leaveWords";

/* -------------------------------------------------------------------------- */
/*  WillQuestion — Will's one question after a Take (founder 2026-10-20, N82; */
/*  prototype https://claude.ai/artifact/HSRfvDZLDRQizmGJDxMUJz).             */
/*                                                                            */
/*  The backend writes the question as the Take's one ask (kind "text",        */
/*  metadata.offer "will_question") with its tap answers in metadata.chips:    */
/*  what the Take said, what the speaker said for an earlier talk, then the   */
/*  signed answers for their field ("Someone else" last on who it is for,     */
/*  N319 item 8). While it is the newest bubble the answers sit under it, on  */
/*  the right; a tap goes to the backend, which writes it and the reply.      */
/*  Typed words in the message box are an answer too (the backend's chat      */
/*  reads them), and so is a voice answer: while it waits the mic is orange   */
/*  (N296 state 2, WillVoiceAnswer.tsx). No Skip (founder 2026-10-31, N296    */
/*  item 2): not answering is allowed, the "+" still opens the projects; a   */
/*  follow-up and the key line (N294 item 2) have no taps.                    */
/* -------------------------------------------------------------------------- */

export const WILL_QUESTION = "will_question";

export type WillQuestionTarget = { arcId: string; takeSessionId: string };

/** Will's question (or its follow-up) in a row's metadata, else null. */
export function willQuestionOf(
  meta: Record<string, unknown> | null | undefined,
): (WillQuestionTarget & { chips: string[] }) | null {
  if (meta?.offer !== WILL_QUESTION) return null;
  const arcId = meta.arc_id;
  const takeSessionId = meta.take_session_id;
  if (typeof arcId !== "string" || typeof takeSessionId !== "string") return null;
  const chips = Array.isArray(meta.chips) ? meta.chips.filter((c): c is string => typeof c === "string") : [];
  return { arcId, takeSessionId, chips };
}

/** Will's question (or its follow-up) waiting for an answer: the newest
 *  bubble drawn (messages oldest first). While it waits the Lounge's mic is
 *  orange and records the answer (backend N296 state 2). */
export function willWaiting(
  drawn: readonly { metadata?: Record<string, unknown> | null }[],
): WillQuestionTarget | null {
  const meta = drawn[drawn.length - 1]?.metadata;
  const will = willQuestionOf(meta);
  const step = meta?.will_question_step;
  return will && (step === "ask" || step === "follow") ? { arcId: will.arcId, takeSessionId: will.takeSessionId } : null;
}

export default function WillQuestionBubble({
  body,
  chips,
  open,
  onAnswer,
}: {
  body: string;
  chips: string[];
  /** The newest bubble: its answers are there to tap. */
  open: boolean;
  onAnswer?: (choice: string) => Promise<void> | void;
}) {
  // One tap at a time: a second tap before the thread reads again is dropped.
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const tap = (choice: string) => {
    if (sending.current || !onAnswer) return;
    sending.current = true;
    setBusy(true);
    void Promise.resolve(onAnswer(choice)).finally(() => {
      sending.current = false;
      setBusy(false);
    });
  };
  return (
    <>
      <div data-row="app" data-will-question="" className="mr-auto flex max-w-[85%] flex-col">
        <div data-bubble="" className="whitespace-pre-wrap break-words rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
          <Linkified text={body} />
        </div>
      </div>
      {open && chips.length > 0 ? (
        // The backend lists the most likely first; the rule puts it nearest the
        // thumb (N371). "Something else" is the first of them, at the top: it
        // opens the box for your own words (N483 item 2).
        <TapRow labels={[SOMETHING_ELSE, ...[...chips].reverse()]} disabled={busy} onTap={tap} dataAttr={{ "data-will-answers": "" }} />
      ) : null}
    </>
  );
}

/** Suggested answers, one rule for the whole app (backend N371): above the
 *  bar on the right, where the speaker's own messages go; each at least 44px
 *  high, 15px, the whole answer readable. The LAST label is the most likely
 *  and sits nearest the thumb, bottom right, filled orange; the others are
 *  outlined, above it or to its left. Two sit side by side (the one that goes
 *  on on the right, N334 item 3); three or four stack, one per line; more
 *  than four show the last three and "Show more" above them. Saying no is a
 *  grey word, never a pill and never the filled one (backend N467 rule 3):
 *  "Not now", "Skip", "Cancel" and "Close", wherever they are offered. Used
 *  by Will's tap answers, his offers, "I want to continue my practice" (N294
 *  item 6), the plan's answers (N319 item 1) and the asks in the chat (N467
 *  item 7). `even` fills none: answers that are all as likely, the sale's
 *  four steps (N417). */
export const SHOW_MORE = "Show more";
/** The bar's middle while Will's question waits, and the box it opens
 *  (backend N371, signed). */
export const SOMETHING_ELSE = "Something else";
export const TYPE_YOUR_ANSWER = "Type your answer";

export function TapRow({
  labels,
  even = false,
  disabled = false,
  onTap,
  dataAttr,
}: {
  labels: string[];
  even?: boolean;
  disabled?: boolean;
  onTap: (label: string) => void;
  dataAttr: Record<string, string>;
}) {
  const [all, setAll] = useState(false);
  const shown = labels.length > 4 && !all ? labels.slice(-3) : labels;
  // A lone button is outlined, never filled: filled orange on the right is
  // what one's own sent message looks like (backend N415 item 1).
  const leaves = (label: string) => LEAVE_WORDS.includes(label);
  const goes = !even && shown.length > 1 ? [...shown].reverse().find((l) => !leaves(l)) : undefined;
  const stacked = shown.length > 2;
  const tap = (label: string) => (
    <button
      key={label}
      type="button"
      disabled={disabled}
      onClick={() => onTap(label)}
      data-quiet={leaves(label) ? "" : undefined}
      data-goes={label === goes ? "" : undefined}
      className={`min-h-[44px] max-w-full text-left text-[15px] leading-snug disabled:opacity-60 ${
        leaves(label)
          ? "px-2.5 font-medium text-muted-foreground"
          : `rounded-[22px] border-[1.5px] border-primary px-4 py-2.5 font-semibold ${
              label === goes ? "bg-primary text-primary-foreground" : "bg-background text-primary"
            }`
      }`}
    >
      {label}
    </button>
  );
  return (
    <div
      {...dataAttr}
      className={`ml-auto flex max-w-[86%] gap-2 pt-0.5 ${stacked ? "flex-col items-end" : "flex-wrap justify-end"}`}
    >
      {shown.length < labels.length ? (
        <button
          type="button"
          data-show-more=""
          onClick={() => setAll(true)}
          className="min-h-[44px] rounded-[22px] border-[1.5px] border-dashed border-primary bg-background px-4 py-2.5 text-[15px] font-semibold text-primary"
        >
          {SHOW_MORE}
        </button>
      ) : null}
      {shown.map(tap)}
    </div>
  );
}

/** An ask's two answers as N371's suggested answers (backend N415 item 2):
 *  the close on the left, a grey word when it leaves ("Not now", "Cancel",
 *  N467 rule 3), else outlined; the one that goes on on the right, filled.
 *  Replaces the equal grey and black pills in every chat (N467 item 7). */
export function AnswerPair({
  closeLabel,
  onClose,
  actionLabel,
  onAction,
}: {
  closeLabel: string;
  onClose: () => void;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <TapRow
      labels={[closeLabel, actionLabel]}
      onTap={(label) => (label === actionLabel ? onAction() : onClose())}
      dataAttr={{ "data-answer-pair": "" }}
    />
  );
}

/** A way to go (backend N467 rule 4): a line of text with ›, on Will's
 *  side, with no card around it. A button, or a link when it has `href`. */
export function ChatLink({
  label,
  onClick,
  href,
  onPointerDown,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  onPointerDown?: () => void;
}) {
  const look = "flex min-h-[40px] items-center gap-1.5 px-0.5 text-left text-[15px] font-medium leading-snug text-foreground";
  const body = (
    <>
      {label}
      <span aria-hidden="true" className="text-[19px] leading-none text-muted-foreground">
        ›
      </span>
    </>
  );
  return href ? (
    <Link href={href} onClick={onClick} onPointerDown={onPointerDown} className={look}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} onPointerDown={onPointerDown} className={look}>
      {body}
    </button>
  );
}

/** Links under one bubble: one per line, on Will's side; nothing when
 *  there are none. */
export function ChatLinks({ children }: { children: ReactNode }) {
  if (Children.toArray(children).length === 0) return null;
  return <div className="mr-auto flex max-w-[90%] flex-col items-start gap-0.5 pt-0.5">{children}</div>;
}

/** The box in Will's bar (backend N483 item 2, N498 item 2): you type to
 *  Will only when he asks for your own words. It opens when you tap
 *  "Something else", the first of his answers (`start`), and by itself
 *  while words are what waits: his follow-up with no answers to tap, or
 *  `wordsWait` ("What was missing?"). Your name is never asked here: it
 *  comes from sign-up. Anything typed keeps it; empty, the box you opened
 *  closes when you tap away (`close`). The plan's questions keep typing off
 *  (N319, N323), so they never show it, and words typed before wait. */
export function useWordsBox(
  shown: readonly { metadata?: Record<string, unknown> | null }[],
  typingOff: boolean,
  draft: string,
  box: RefObject<HTMLTextAreaElement | null>,
  wordsWait = false,
): { show: boolean; start: () => void; close: () => void } {
  const asks = willWaiting(shown) !== null && !typingOff;
  const noTaps = asks && (willQuestionOf(shown[shown.length - 1]?.metadata)?.chips.length ?? 0) === 0;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!asks) setOpen(false);
  }, [asks]);
  return {
    show: !typingOff && (!!draft || open || noTaps || wordsWait),
    // The box is drawn and focused inside the tap itself: a phone opens its
    // keyboard only for a focus made while the tap is handled, so a focus a
    // frame later left the box focused, keyboard down, a second tap needed.
    start: () => {
      flushSync(() => setOpen(true));
      box.current?.focus();
    },
    close: () => setOpen(false),
  };
}
