"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Mic } from "lucide-react";
import { getHost, markOf, type AnswerWith, type Host, type Mark } from "@/services/api/assistants";
import type { ChatMessage } from "@/services/api/chats";
import { AssistantMark } from "./ChatList";

/* -------------------------------------------------------------------------- */
/*  A host's own chat, as the person who joined it meets it (backend N578     */
/*  item 1, N580 item 3, N586 item 1, N590 item 2): on top, who the host is   */
/*  and what you can learn with them, in the host's own words; then the       */
/*  host's welcome, first, as their assistant's messages, each labelled       */
/*  "{name}'s assistant" with the assistant's mark (an AI answers for them,  */
/*  AI Act article 50). The welcome rows are the backend's (meta.assistant);  */
/*  GET /v2/chats/<id>/host says whose assistant it is. Behind the ring row  */
/*  `chat_builder`: without it, or for a host with no recipe, the read is     */
/*  {host: null} (or 404 on a backend without the route) and the chat is as   */
/*  it was.                                                                   */
/* -------------------------------------------------------------------------- */

/** The host's chat as the person in it reads it, or null. */
export function useHost(chatId: string): Host | null {
  const [host, setHost] = useState<Host | null>(null);
  useEffect(() => {
    setHost(null);
    let alive = true;
    void getHost(chatId).then((got) => {
      if (alive) setHost(got);
    });
    return () => {
      alive = false;
    };
  }, [chatId]);
  return host;
}

/** Who the host is and what you can learn with them (N586 item 1), above
 *  the messages; nothing without lines. */
export function AssistantAbout({ host }: { host: Host | null }) {
  return <HostAboutLines lines={host?.about ?? []} />;
}

/** The host's about lines as one card (the chat's top, and the join page). */
export function HostAboutLines({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <div data-host-about="" className="mb-2 flex max-w-[86%] flex-col gap-1 self-center rounded-xl bg-muted px-3 py-2 text-center text-[13.5px] leading-snug text-foreground">
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}

/** A message the assistant wrote for the host (meta.assistant), with its
 *  label above it; any other message as it is. */
export function AssistantSays({ name, message, children }: { name: string | null; message: ChatMessage; children: ReactNode }) {
  if (!name || message.mine || message.meta?.assistant !== true) return <>{children}</>;
  return (
    <div data-assistant-says="" className="flex flex-col gap-1">
      <span className="mr-auto flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
        <AssistantMark label={name} inline />
        {name}
      </span>
      {children}
    </div>
  );
}

/** How sure a match is, as a colour, never a number (backend N580 item 3,
 *  N585 item 2): green sure, yellow in between, red unsure. */
const MARK_COLOUR: Record<Mark, string> = { green: "#16A34A", yellow: "#EAB308", red: "#DC2626" };

export function MarkDot({ mark }: { mark: Mark | null }) {
  if (!mark) return null;
  return <span aria-hidden data-mark={mark} className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: MARK_COLOUR[mark] }} />;
}

/** One recording sent to everyone who asked the same thing (backend N584
 *  item 3): in each person's own chat, under their own question quoted,
 *  with the match's colour. Any other message as it is. */
export function AnswerQuote({ message, children }: { message: ChatMessage; children: ReactNode }) {
  const quote = message.meta?.quote as { words?: unknown } | undefined;
  const words = typeof quote?.words === "string" ? quote.words.trim() : "";
  if (!words) return <>{children}</>;
  return (
    <div data-answer-quote="" className={`flex flex-col gap-1 ${message.mine ? "items-end" : "items-start"}`}>
      <span className="flex max-w-[85%] items-start gap-2 border-l-2 border-border pl-2 text-[13px] leading-snug text-muted-foreground">
        <MarkDot mark={markOf(message.meta?.mark)} />
        <span data-answer-quote-words="">{words}</span>
      </span>
      {children}
    </div>
  );
}

/* ── The bar in a host's chat (backend N600, amending N597 items 1, 2) ─── */

/** Whether the backend keeps typed words between people. It does not yet:
 *  POST /v2/chats/<id>/messages takes the three emoji only (anything else is
 *  400), so the typing box waits and the emoji keep the middle. */
export const TYPED_WORDS_SENT = false;

/** What the bar holds in a host's chat, from the host's answer_with
 *  (N600 items 1 to 3): the "+" always on the left; the typing box in the
 *  middle when Type is chosen, else the three emoji; a small mic on the
 *  right when Record is chosen. Tap answers sit above the bar, with no
 *  "Something else". The same at rest and while a question waits: the
 *  question adds its taps and "Not now" above, nothing else. */
export function hostBar(answerWith: AnswerWith, typing: boolean = TYPED_WORDS_SENT): { middle: "box" | "emoji"; mic: boolean } {
  return { middle: answerWith.type && typing ? "box" : "emoji", mic: answerWith.record };
}

/** The small mic on the right of a host's bar (N600 item 1): it records
 *  the answer to what waits, else a question over the default presentation,
 *  on the recording screens, as "Record your answer" and the "+" did. */
export function HostMic({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-chat-mic=""
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
    >
      <Mic className="h-5 w-5" aria-hidden />
    </button>
  );
}
