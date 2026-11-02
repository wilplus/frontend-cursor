"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, Mic } from "lucide-react";
import { CHUNK_SHEET_COPY } from "@/components/willab/idealEditCopy";
import RecordingBar from "@/components/willab/RecordingBar";
import TypingDots from "@/components/willab/TypingDots";
import { VoicePlayer } from "@/components/willab/plan/VoicePlayer";
import { useBackDismiss } from "@/components/willab/useBackDismiss";
import { useVoiceNote } from "@/components/willab/useVoiceNote";
import {
  CHAT_EMOJI,
  chatVoiceSrc,
  getChatThread,
  sendChatEmoji,
  sendChatVoice,
  type Chat,
  type ChatEmoji,
  type ChatMessage,
} from "@/services/api/chats";
import { EMOJI_MEANING, LetterCircle, WILL_ROW_TITLE, WillMark, meaningOf } from "./ChatList";
import { markChatOpened } from "./chatOpened";
import { joinedThrough } from "./joinCopy";
import { clockTime, dayKey, dayLabel } from "./chatTime";

/* -------------------------------------------------------------------------- */
/*  A chat with someone (backend N298, N302, N306, N311, N321, N322; rules:   */
/*  docs/flows/customer-requests.md §1 C1). Its own top bar in the            */
/*  WillpowerLab bar's place (the door hides that one, N321 item 1): back,    */
/*  the circle with the first letter, the name and who they are. Then the     */
/*  Lounge's own chat design (N301): its grey and orange bubbles, no picture  */
/*  beside them, each with its time; the messages start at the bottom, by the */
/*  bar, under the day ("Today"). The locked bar's shape with the three emoji */
/*  in the box where Will's chat has "Type here" (N306), and the mic beside   */
/*  it only while a question waits for your answer (N341; was N321 item 2).   */
/*  Only the conversation shows here; no asks (N305).                         */
/* -------------------------------------------------------------------------- */

/** Will's chat, under the WillpowerLab bar: back, then his name (N322 item 4). */
/** Every chat's own top bar, full width, where the WillpowerLab bar was
 *  (backend N321 item 1, N334): back, the circle, the name, and who they are. */
function TopBar({ circle, title, subtitle = null, onBack }: { circle: ReactNode; title: string; subtitle?: string | null; onBack: () => void }) {
  return (
    <div
      data-chat-header
      className="box-content flex h-[60px] shrink-0 items-center gap-1 border-b border-border pl-1 pr-4 pt-[env(safe-area-inset-top)]"
    >
      <button
        type="button"
        onClick={onBack}
        aria-label={CHUNK_SHEET_COPY.pagerBack}
        className="walk-press-sm flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground"
      >
        <ChevronLeft className="h-6 w-6" aria-hidden />
      </button>
      <span className="flex min-w-0 items-center gap-2.5">
        {circle}
        <span className="flex min-w-0 flex-col">
          <span data-chat-name className="truncate text-[16px] font-semibold leading-tight text-foreground">
            {title}
          </span>
          {subtitle ? <span className="truncate text-[12.5px] leading-tight text-muted-foreground">{subtitle}</span> : null}
        </span>
      </span>
    </div>
  );
}

/** A person's chat's top bar: the letter circle, the name, who they are. */
function ChatTopBar({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  return (
    <TopBar circle={<LetterCircle id={chat.id} name={chat.title} size={36} />} title={chat.title} subtitle={chat.subtitle} onBack={onBack} />
  );
}

/** Will's chat's top bar, over the Lounge: his mark and his name; the
 *  WillpowerLab bar is on the list only (backend N334 item 1). It spans the
 *  Lounge's column, across its side padding. */
export function WillTopBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="-mx-4">
      <TopBar circle={<WillMark size={36} />} title={WILL_ROW_TITLE} onBack={onBack} />
    </div>
  );
}

/** The two words under a voice note's player (backend N331, signed). */
export const READ_IT = "Read it";
export const HIDE_WORDS = "Hide";

/** A voice note's words, closed under its player (backend N331): "Read it"
 *  opens them inside the bubble, "Hide" closes them. Closed by default, for
 *  both people, so the voice is heard; shown only once there are words. */
function VoiceWords({ words, mine }: { words: string; mine: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-chat-read=""
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className={`self-start py-1 text-[12.5px] font-semibold underline underline-offset-[3px] ${
          mine ? "text-primary-foreground" : "text-foreground"
        }`}
      >
        {open ? HIDE_WORDS : READ_IT}
      </button>
      {open ? (
        <p data-chat-words="" className="mb-0.5 mt-1 whitespace-pre-wrap break-words text-[14.5px] leading-[1.45]">
          {words}
        </p>
      ) : null}
    </>
  );
}

/** A voice note (N321 item 2), in the same bubble: the plan's small player
 *  (play, the drawn bars, the length), its time bottom right, and its words
 *  behind "Read it" once they are ready (N331). */
function ChatVoice({ chatId, message, time }: { chatId: string; message: ChatMessage; time: string }) {
  const ms = typeof message.meta?.duration_ms === "number" ? message.meta.duration_ms : null;
  const words = typeof message.words === "string" && message.words.trim() ? message.words : null;
  const player = <VoicePlayer src={chatVoiceSrc(chatId, message.id)} tone={message.mine ? "orange" : "grey"} durationMs={ms} />;
  const stamp = time ? (
    <span
      data-chat-time
      className={`shrink-0 text-[11px] leading-none ${message.mine ? "text-primary-foreground/90" : "text-muted-foreground"}`}
    >
      {time}
    </span>
  ) : null;
  const body = (
    <>
      <span className="flex items-end gap-2.5">
        {player}
        {stamp}
      </span>
      {words ? <VoiceWords words={words} mine={message.mine} /> : null}
    </>
  );
  if (message.mine) {
    return (
      <div
        data-row="me"
        data-bubble=""
        data-chat-voice=""
        className="ml-auto flex max-w-[85%] flex-col rounded-2xl bg-primary py-2 pl-2 pr-3 text-primary-foreground"
      >
        {body}
      </div>
    );
  }
  return (
    <div data-row="app" className="mr-auto flex max-w-[88%]">
      <div data-bubble="" data-chat-voice="" className="flex flex-col rounded-[16px] bg-muted py-2 pl-2 pr-3 text-foreground">
        {body}
      </div>
    </div>
  );
}

/** One message, as the Lounge draws it: theirs grey on the left, mine orange
 *  on the right, its time inside, bottom right; an emoji large, with its
 *  meaning and time under it; a voice note with its player. */
function ChatRow({ chatId, message }: { chatId: string; message: ChatMessage }) {
  const time = clockTime(message.created_at);
  if (message.kind === "voice") return <ChatVoice chatId={chatId} message={message} time={time} />;
  if (message.kind === "emoji") {
    const caption = [meaningOf(message.body), time].filter(Boolean).join(" · ");
    return (
      <div data-chat-emoji className={`flex flex-col ${message.mine ? "ml-auto items-end" : "mr-auto items-start"}`}>
        <span className="text-[56px] leading-[1.1]">{message.body}</span>
        {caption ? <span className="text-[12px] font-medium leading-[1.3] text-muted-foreground">{caption}</span> : null}
      </div>
    );
  }
  const stamp = time ? (
    <span
      data-chat-time
      className={`float-right -mb-1 ml-2.5 mt-[7px] text-[11px] leading-none ${
        message.mine ? "text-primary-foreground/90" : "text-muted-foreground"
      }`}
    >
      {time}
    </span>
  ) : null;
  if (message.mine) {
    return (
      <div data-row="me" data-bubble="" className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-primary px-3 py-2 text-[15px] text-primary-foreground">
        {message.body}
        {stamp}
      </div>
    );
  }
  return (
    <div data-row="app" className="mr-auto flex max-w-[88%]">
      <div data-bubble="" className="whitespace-pre-wrap break-words rounded-[16px] bg-muted px-3 py-2 text-[15px] leading-[1.45] text-foreground">
        {message.body}
        {stamp}
      </div>
    </div>
  );
}

/** The day above each day's first message: "Today", or the date. */
function ChatDay({ label }: { label: string }) {
  return (
    <div data-chat-day className="max-w-[90%] self-center pb-0.5 pt-1.5 text-center text-[12px] text-muted-foreground">
      {label}
    </div>
  );
}

/** For the one who joined through someone's link, above the messages: how
 *  the two are connected (N335 item 2, signed). */
function JoinedLine({ name }: { name: string }) {
  return (
    <div data-chat-joined className="max-w-[86%] self-center rounded-xl bg-muted px-3 py-2 text-center text-[13.5px] leading-snug text-foreground">
      {joinedThrough(name)}
    </div>
  );
}

/** Each message, with the day line before the first of each day. */
function withDays(messages: readonly ChatMessage[]): { day: string | null; message: ChatMessage }[] {
  const now = new Date();
  return messages.map((message, i) => {
    const key = dayKey(message.created_at);
    const opens = key !== "" && (i === 0 || dayKey(messages[i - 1].created_at) !== key);
    return { day: opens ? dayLabel(message.created_at, now) : null, message };
  });
}

/** A question waits for my answer (backend N341 item 1): the newest message
 *  is the other person's, and it is a question: their words (people never
 *  type, N335 item 4, so words come only from a customer's request) or a
 *  message the backend marks as one (`meta.question`). My answer, an emoji
 *  or a voice note, is then the newest, and nothing waits. */
export function questionWaits(messages: readonly ChatMessage[] | null): boolean {
  const newest = messages?.at(-1);
  if (!newest || newest.mine) return false;
  return newest.kind === "text" || newest.meta?.question === true;
}

/** The locked bar's shape (the Lounge's composer): the rounded box, with the
 *  three emoji as round buttons in it, and on its right the Lounge's mic,
 *  40px and plain, only while a question waits (N341; the prototype's
 *  `pBar`). No typing outside Will's chat. */
function EmojiBar({ onPick, onMic }: { onPick: (emoji: ChatEmoji) => void; onMic: (() => void) | null }) {
  return (
    <>
      <div data-chat-emoji-box className="flex min-h-[40px] min-w-0 flex-1 items-center justify-around rounded-3xl border border-border bg-background px-2">
        {CHAT_EMOJI.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={EMOJI_MEANING[emoji]}
            onClick={() => onPick(emoji)}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[23px] leading-none transition-colors hover:bg-muted"
          >
            {emoji}
          </button>
        ))}
      </div>
      {onMic ? (
        <button
          type="button"
          onClick={onMic}
          aria-label="Voice note"
          data-chat-mic=""
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <Mic className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </>
  );
}

let localSeq = 0;

export default function ChatThread({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [through, setThrough] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useBackDismiss(onBack);

  // The voice note (N321 item 2): the mic records with the one recording
  // bar, up to two minutes; Stop sends, the trash throws it away. The bar
  // comes back at once; the message joins the thread when the backend has
  // kept it. A refused mic, a failed recording or a failed send shows
  // nothing new.
  const note = useVoiceNote({
    maxSeconds: 120,
    onDone: async ({ audio, durationMs }) => {
      const sent = await sendChatVoice(chat.id, audio, durationMs);
      if (sent) setMessages((list) => [...(list ?? []), sent]);
    },
  });

  // Opened: on arrival, as its messages land, and on leaving. The list then
  // no longer shows it as new (N322).
  const lastAt = chat.last?.created_at ?? null;
  useEffect(() => {
    markChatOpened(chat.id, lastAt);
    return () => markChatOpened(chat.id);
  }, [chat.id, lastAt]);
  useEffect(() => {
    const newest = messages?.at(-1);
    if (newest) markChatOpened(chat.id, newest.created_at);
  }, [chat.id, messages]);

  useEffect(() => {
    let cancelled = false;
    void getChatThread(chat.id).then((thread) => {
      if (cancelled) return;
      setMessages(thread?.messages ?? []);
      setThrough(thread?.joinedThrough ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [chat.id]);

  // The newest message in view, as in the Lounge.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Drawn at once; the backend's copy replaces it, a failed send takes it away.
  const send = async (emoji: ChatEmoji) => {
    localSeq += 1;
    const local: ChatMessage = {
      id: `local-${localSeq}`,
      mine: true,
      author: "",
      kind: "emoji",
      body: emoji,
      meta: null,
      created_at: new Date().toISOString(),
    };
    setMessages((list) => [...(list ?? []), local]);
    const sent = await sendChatEmoji(chat.id, emoji);
    setMessages((list) => (list ?? []).flatMap((m) => (m.id !== local.id ? [m] : sent ? [sent] : [])));
  };

  return (
    <div data-chat-screen className="flex min-h-0 flex-1 flex-col">
      <ChatTopBar chat={chat} onBack={onBack} />
      <div
        ref={scrollRef}
        data-chat-thread
        className="scrollbar-none flex flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-3 pt-4"
      >
        {/* The messages start at the bottom, by the bar (N321 item 3). */}
        <div className="mt-auto flex flex-col gap-2">
          {through ? <JoinedLine name={through} /> : null}
          {messages === null ? (
            <TypingDots label="Loading" />
          ) : (
            withDays(messages).flatMap(({ day, message }) => [
              ...(day ? [<ChatDay key={`day-${message.id}`} label={day} />] : []),
              <ChatRow key={message.id} chatId={chat.id} message={message} />,
            ])
          )}
        </div>
      </div>
      <div data-chat-bar className="flex shrink-0 items-end gap-1 px-4 pb-2">
        {note.phase === "recording" ? (
          <div className="min-w-0 flex-1">
            <RecordingBar elapsedMs={note.elapsedMs} onTrash={note.cancel} onStop={note.send} />
          </div>
        ) : (
          <EmojiBar onPick={(emoji) => void send(emoji)} onMic={questionWaits(messages) ? () => void note.start() : null} />
        )}
      </div>
    </div>
  );
}
