"use client";

import { useState, type ReactNode } from "react";
import { TapRow } from "../../WillQuestion";
import type { ChatMessage } from "@/services/api/chats";
import { answerUseful } from "@/services/api/hostSetup";
import { W } from "./hostSetupCopy";

/* -------------------------------------------------------------------------- */
/*  What a visitor meets in a chat set up with the blank setup (backend N616  */
/*  items 4 and 6, N618 item 8; VIS-01 to VIS-05): the host's hello and the   */
/*  taps before they have sent anything, who each line of what comes back is */
/*  from (the host, "{name}'s assistant", or "{owner}'s model", as the        */
/*  backend names it in meta.reply and meta.model_line), and "Was this        */
/*  useful?" under the last one, which never stands before the bar. Nothing   */
/*  here draws for a chat without a live v2 recipe: its rows carry none of    */
/*  these and its host read has no taps.                                      */
/* -------------------------------------------------------------------------- */

type Meta = Record<string, unknown> | null | undefined;
const field = (meta: Meta, key: string, sub: string): string => {
  const v = (meta?.[key] as Record<string, unknown> | undefined)?.[sub];
  return typeof v === "string" ? v : "";
};

/** A walk line: one of the host's own models noticing its thing in what
 *  the person sent, as the host's saved walk has it (backend N647 item 8). */
const walkLine = (m: ChatMessage) => !m.mine && Boolean(m.meta?.walk_line && typeof m.meta.walk_line === "object");

/** Who a line of what came back is from, under it (VIS-03, VIS-04); under
 *  a walk line, its own "Was this useful?" (N647 item 8). */
export function ReplyBy({ message, chatId, children }: { message: ChatMessage; chatId?: string; children: ReactNode }) {
  const by = message.mine ? "" : field(message.meta, "model_line", "by") || field(message.meta, "reply", "name");
  const ask = chatId && walkLine(message) ? <UsefulTaps chatId={chatId} message={message} /> : null;
  if (!by && !ask) return <>{children}</>;
  return (
    <div data-reply-by="" className="flex flex-col gap-1">
      {children}
      {by ? (
        <span className="mr-auto flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#2F9E6E]" />
          {by}
        </span>
      ) : null}
      {ask}
    </div>
  );
}

/** "Did this help?" for one walk line (N647): Yes, No or Skip, answered
 *  once, then gone; one already answered (meta.useful) does not ask again. */
function UsefulTaps({ chatId, message }: { chatId: string; message: ChatMessage }) {
  const [answered, setAnswered] = useState(false);
  if (answered || message.meta?.useful_ask !== true || message.meta?.useful != null) return null;
  const pick = (label: string) => {
    setAnswered(true);
    const answer = label === W.yes ? "yes" : label === W.no ? "no" : "skip";
    void answerUseful(chatId, message.id, answer);
  };
  return (
    <div data-useful-ask="" data-useful-for={message.id} className="flex flex-col gap-2 pt-2">
      <Line>{W.didThisHelp}</Line>
      <TapRow even labels={[W.yes, W.no, W.skip]} dataAttr={{ "data-useful-taps": "" }} onTap={pick} />
    </div>
  );
}

/** The hello, then the taps under "Tell me what you'd like to do…", while the
 *  visitor has sent nothing yet (VIS-01). A tap is sent as their message. */
export function HostHello({ hello, taps, messages, onTap }: {
  hello: string;
  taps: readonly string[];
  messages: readonly ChatMessage[] | null;
  onTap: (label: string) => void;
}) {
  // "Something else" alone is no choice: a recipe with no taps draws none.
  const choices = taps.some((t) => t !== W.somethingElse) ? taps : [];
  if (!messages || sentSinceHello(messages) || (!hello && !choices.length)) return null;
  return (
    <div data-host-hello="" className="flex flex-col gap-2 pt-1">
      {hello && !messages.length ? <Line>{hello}</Line> : null}
      {choices.length ? (
        <>
          <Line>{W.tellMe}</Line>
          <TapRow even labels={[...choices]} dataAttr={{ "data-visitor-taps": "" }} onTap={onTap} />
        </>
      ) : null}
    </div>
  );
}

/** Has the person sent anything since the chat's hello reached them? The
 *  hello is the other person's newest welcome row (meta.welcome): written on
 *  joining through their link, or in a chat the two already share when the
 *  person first opens it after that chat opened (backend N633 item 2), so
 *  what was said there before does not hide the taps. Without such a row,
 *  anything sent. One's own welcome rows are not the hello. */
function sentSinceHello(messages: readonly ChatMessage[]): boolean {
  let start = 0;
  messages.forEach((m, k) => {
    if (!m.mine && m.meta && typeof m.meta === "object" && "welcome" in m.meta) start = k + 1;
  });
  return messages.slice(start).some((m) => m.mine);
}

function Line({ children }: { children: ReactNode }) {
  return <div className="mr-auto max-w-[85%] rounded-2xl bg-muted px-3.5 py-2.5 text-[16px] leading-snug text-foreground">{children}</div>;
}

/** "Was this useful?" under the newest line that asks it (VIS-05): Yes, No
 *  or Skip, or nothing at all; the bar is ready for the next one meanwhile.
 *  A walk line asks under itself instead (ReplyBy). */
export function UsefulAsk({ chatId, messages }: { chatId: string; messages: readonly ChatMessage[] | null }) {
  const [answered, setAnswered] = useState<string[]>([]);
  const last = messages?.[messages.length - 1];
  // One already answered (meta.useful) does not ask again after a reload.
  if (!last || last.mine || walkLine(last) || last.meta?.useful_ask !== true || last.meta?.useful != null || answered.includes(last.id)) return null;
  const pick = (label: string) => {
    setAnswered((was) => [...was, last.id]);
    const answer = label === W.yes ? "yes" : label === W.no ? "no" : "skip";
    void answerUseful(chatId, last.id, answer);
  };
  return (
    <div data-useful-ask="" className="flex flex-col gap-2 pt-2">
      <Line>{W.useful}</Line>
      <TapRow even labels={[W.yes, W.no, W.skip]} dataAttr={{ "data-useful-taps": "" }} onTap={pick} />
    </div>
  );
}
