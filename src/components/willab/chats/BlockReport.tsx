"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { reportChat, setChatBlocked, type Chat } from "@/services/api/chats";
import { CANCEL } from "./joinCopy";

/* -------------------------------------------------------------------------- */
/*  Block and Report in a chat with a person (backend N466, the locked        */
/*  prototype "One bar" with its Block and Report additions; rules:           */
/*  docs/flows/customer-requests.md §1 C1). At the foot of their profile, two */
/*  red rows, "Block {name}" and "Report {name}"; once blocked, the first     */
/*  reads "Unblock {name}", not red. Block and Report each ask first, in a    */
/*  sheet like the add sheet; Unblock does not. Blocked, the chat's bar is    */
/*  one grey pill, "You blocked {name}." with Unblock. A small black toast    */
/*  near the top says what happened. Red is the prototype's #B42318. Never in */
/*  Will's chat, never on your own profile. {name} is the other person's name */
/*  as the chat shows it.                                                     */
/* -------------------------------------------------------------------------- */

/** Signed (Never 4): backend N466 items 1 to 3. */
export const blockName = (name: string) => `Block ${name}`;
export const unblockName = (name: string) => `Unblock ${name}`;
export const reportName = (name: string) => `Report ${name}`;
export const blockAsk = (name: string) => `Block ${name}?`;
export const blockLine = (name: string) => `${name} can't send you messages or answers. ${name} isn't told.`;
export const BLOCK = "Block";
export const UNBLOCK = "Unblock";
export const reportAsk = (name: string) => `Report ${name}?`;
export const reportLine = (name: string) =>
  `The last five messages in this chat go to WillpowerLab, where a person reads them within a day. ${name} isn't told.`;
export const REPORT = "Report";
export const REPORT_AND_BLOCK = "Report and block";
export const youBlocked = (name: string) => `You blocked ${name}.`;
export const isBlocked = (name: string) => `${name} is blocked.`;
export const isUnblocked = (name: string) => `${name} is unblocked.`;
export const REPORTED = "Reported. Thank you.";
export const REPORTED_AND_BLOCKED = "Reported and blocked.";

const TOAST_MS = 2200;

/** What a person's profile needs to show its foot: the chat's name for them,
 *  whether you blocked them, and the three things you can do. */
export type Safety = {
  name: string;
  blocked: boolean;
  block: () => void;
  unblock: () => void;
  report: (andBlock: boolean) => void;
};

/** A small black pill near the top, gone after about two seconds (the
 *  prototype's `.toast`). Needs a `relative` parent. */
function ChatToast({ text, onGone }: { text: string; onGone: () => void }) {
  const gone = useRef(onGone);
  gone.current = onGone;
  useEffect(() => {
    const t = window.setTimeout(() => gone.current(), TOAST_MS);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div
      role="status"
      data-chat-toast=""
      className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top)+70px)] z-50 max-w-[86%] -translate-x-1/2 rounded-xl bg-[#121212] px-3.5 py-2 text-center text-[13px] text-white"
    >
      {text}
    </div>
  );
}

/** Block, unblock and report in one chat, and the toast that says each was
 *  done. Each waits for the backend: a refusal changes nothing and says
 *  nothing. `blocked` starts from the list's chat; the thread's read then
 *  sets it (`setBlocked`). */
export function useBlocking(chat: Chat): Safety & { setBlocked: (blocked: boolean) => void; toast: ReactNode } {
  const [blocked, setBlocked] = useState(chat.blocked === true);
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null);
  const seq = useRef(0);
  const say = (text: string) => {
    seq.current += 1;
    setToast({ seq: seq.current, text });
  };
  const name = chat.title;
  const turn = async (to: boolean) => {
    if (!(await setChatBlocked(chat.id, to))) return;
    setBlocked(to);
    say(to ? isBlocked(name) : isUnblocked(name));
  };
  const report = async (andBlock: boolean) => {
    const done = await reportChat(chat.id, andBlock);
    if (!done) return;
    setBlocked(done.blocked);
    say(andBlock ? REPORTED_AND_BLOCKED : REPORTED);
  };
  return {
    name,
    blocked,
    setBlocked,
    block: () => void turn(true),
    unblock: () => void turn(false),
    report: (andBlock) => void report(andBlock),
    toast: toast ? <ChatToast key={toast.seq} text={toast.text} onGone={() => setToast(null)} /> : null,
  };
}

type Action = { label: string; tone: "red" | "line"; act: () => void };

/** The one confirmation sheet (the prototype's `askSheet`), shaped like the
 *  add sheet: a handle, the title large, the grey line, a full-width round
 *  button for each action (filled red, or outlined red), Cancel. Needs a
 *  positioned parent. */
function AskSheet({ title, line, actions, onClose }: { title: string; line: string; actions: Action[]; onClose: () => void }) {
  return (
    <div data-ask-sheet="" className="absolute inset-0 z-10 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="flex flex-col gap-3.5 rounded-t-3xl bg-white px-[18px] pb-6 pt-2.5 text-[#121212]"
        onClick={(e) => e.stopPropagation()}
      >
        <span aria-hidden className="h-[5px] w-10 self-center rounded-full bg-[#E0E0E0]" />
        <p className="mt-1 text-[21px] font-bold leading-tight">{title}</p>
        <p className="text-[15px] leading-snug text-[#5F5F5F]">{line}</p>
        {actions.map(({ label, tone, act }) => (
          <button
            key={label}
            type="button"
            data-ask-action={label}
            onClick={() => {
              onClose();
              act();
            }}
            className={`h-[52px] rounded-full text-[16px] font-semibold ${
              tone === "red" ? "bg-[#B42318] text-white" : "border-[1.5px] border-[#B42318] bg-white text-[#B42318]"
            }`}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={onClose} className="h-10 text-[15px] font-medium text-[#737373]">
          {CANCEL}
        </button>
      </div>
    </div>
  );
}

/** The foot of a person's profile (the prototype's `.safety` box): "Block
 *  {name}" (or "Unblock {name}", not red) and "Report {name}". Block and
 *  Report open their sheet; Unblock is done at once. */
export function SafetyRows({ safety }: { safety: Safety }) {
  const [asking, setAsking] = useState<null | "block" | "report">(null);
  const { name, blocked } = safety;
  const close = () => setAsking(null);
  return (
    <div data-profile-safety="" className="bg-white px-[18px] py-1">
      <button
        type="button"
        data-profile-block=""
        onClick={() => (blocked ? safety.unblock() : setAsking("block"))}
        className={`block w-full border-b border-[#F0F0F0] py-3.5 text-left text-[16px] font-medium ${
          blocked ? "text-[#121212]" : "text-[#B42318]"
        }`}
      >
        {blocked ? unblockName(name) : blockName(name)}
      </button>
      <button
        type="button"
        data-profile-report=""
        onClick={() => setAsking("report")}
        className="block w-full py-3.5 text-left text-[16px] font-medium text-[#B42318]"
      >
        {reportName(name)}
      </button>
      {asking === "block" ? (
        <AskSheet title={blockAsk(name)} line={blockLine(name)} actions={[{ label: BLOCK, tone: "red", act: safety.block }]} onClose={close} />
      ) : asking === "report" ? (
        <AskSheet
          title={reportAsk(name)}
          line={reportLine(name)}
          actions={[
            { label: REPORT, tone: "red", act: () => safety.report(false) },
            { label: REPORT_AND_BLOCK, tone: "line", act: () => safety.report(true) },
          ]}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

/** A blocked chat's bar: one grey pill, "You blocked {name}." with a white
 *  Unblock on its right (the prototype's `.blockedbar`), in place of the
 *  "+", the middle and the mic. */
export function BlockedBar({ name, onUnblock }: { name: string; onUnblock: () => void }) {
  return (
    <div
      data-chat-blocked=""
      className="flex h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-full bg-[#F2F2F2] pl-[18px] pr-1.5 text-[14.5px] font-medium text-[#5F5F5F]"
    >
      <span className="min-w-0 truncate">{youBlocked(name)}</span>
      <button
        type="button"
        data-chat-unblock=""
        onClick={onUnblock}
        className="h-9 shrink-0 rounded-full bg-white px-4 text-[14.5px] font-semibold text-[#121212]"
      >
        {UNBLOCK}
      </button>
    </div>
  );
}
