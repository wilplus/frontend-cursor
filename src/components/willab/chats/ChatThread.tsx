"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Plus, X } from "lucide-react";
import { CHUNK_SHEET_COPY } from "@/components/willab/idealEditCopy";
import TypingDots from "@/components/willab/TypingDots";
import { VoicePlayer } from "@/components/willab/plan/VoicePlayer";
import { useBackDismiss } from "@/components/willab/useBackDismiss";
import { isNativeApp } from "@/lib/auth/nativeSignIn";
import { TapRow } from "@/components/willab/WillQuestion";
import { NOT_NOW } from "@/lib/willab/leaveWords";
import { PLAN_COPY, fmtShort, isoDay } from "@/lib/willab/planCopy";
import {
  UNDO_MS,
  askedBefore,
  markPlusSeen,
  onAnswerSent,
  plusSeen,
  sendAgain,
  undoAnswer,
  usePendingAnswer,
  type AnswerFor,
} from "@/lib/willab/chatAnswer";
import AskSheet, { askName } from "./AskSheet";
import {
  CHAT_EMOJI,
  answerChatSetup,
  declineInChat,
  chatFileSrc,
  chatVoiceSrc,
  getChatThread,
  setupOf,
  sendChatEmoji,
  type Chat,
  type ChatEmoji,
  type ChatMessage,
  type SetupQuestion,
} from "@/services/api/chats";
import Profile from "./Profile";
import { BlockedBar, useBlocking } from "./BlockReport";
import { EMOJI_MEANING, LetterCircle, firstName, meaningOf, takeSentYou } from "./ChatList";
import { TopBar } from "./TopBar";
// The top bars live in ./TopBar, so Will's draws without this chat's code;
// the coach's queue still imports TopBar from here.
export { TopBar, WillTopBar } from "./TopBar";
import { fetchChatTake, type ChatTake } from "@/services/api/takeSends";
import { fmtClock } from "@/components/willab/willabHelpers";
import { markChatOpened } from "./chatOpened";
import { SEND_PICKED, answersOf, joinedAsks, joinedThanks, joinedYourLink } from "./joinCopy";
import { MonthGrid } from "../plan/MonthGrid";
import { clockTime, dayKey, dayLabel } from "./chatTime";

/* -------------------------------------------------------------------------- */
/*  A chat with someone (backend N298, N302, N306, N311, N321, N322; rules:   */
/*  docs/flows/customer-requests.md §1 C1). Its own top bar in the            */
/*  WillpowerLab bar's place (the door hides that one, N321 item 1): back,    */
/*  the circle with the first letter, the name and who they are. Then the     */
/*  Lounge's own chat design (N301): its grey and orange bubbles, no picture  */
/*  beside them, each with its time; the messages start at the bottom, by the */
/*  bar, under the day ("Today"). The locked bar (N483): the "+" on the left, */
/*  which opens "Ask {name}" (a question recorded over the default           */
/*  presentation, N498), and the three emoji in the middle. A question about  */
/*  a product or a treatment (Will marks it, N361 item 1), or one they asked  */
/*  you, takes one black "Record your answer" in the middle (N483 items 3     */
/*  and 5), "Not now" under it: the recording screens, then "Sending to       */
/*  {name}…" with Undo for 5 seconds (N345), then the answer or the question, */
/*  with "Sent to {name}" under it (N342, N361). No mic, no typing.           */
/*  Only the conversation shows here; no asks (N305). Blocked from their      */
/*  profile, the bar is one grey pill with Unblock; the messages stay (N466). */
/* -------------------------------------------------------------------------- */

/** The device's Back (the iPhone's swipe, the browser's Back) closes the
 *  chat while it is the screen: one step, to the list (N378). */
export function BackIsThisChats({ onBack }: { onBack: () => void }) {
  useBackDismiss(onBack);
  return null;
}

/** A person's chat's top bar: the letter circle, the name, who they are. */
export function ChatTopBar({ chat, onBack, onOpen }: { chat: Chat; onBack: () => void; onOpen: () => void }) {
  return (
    <TopBar
      circle={<LetterCircle id={chat.id} name={chat.title} size={36} />}
      title={chat.title}
      subtitle={chat.subtitle}
      onBack={onBack}
      onOpen={onOpen}
    />
  );
}

/** The two words under a voice note's player (backend N331, signed). */
/** Signed: N321 item 4, N345 item 3, N342 item 3, N361 item 2, N441 items
 *  1 and 4. "Sent to {name}" for everyone until answers are delivered on
 *  WhatsApp; a customer's line then goes back to "Sent to {name} on
 *  WhatsApp" (N342). */
/** One label for answering anyone (backend N483 item 5; was "Record an
 *  answer", N361). */
export const RECORD_YOUR_ANSWER = PLAN_COPY.recordAnswer;
export const UNDO = "Undo";
export const NOT_SENT = "Not sent";
export const SEND_AGAIN = "Send again";
export const sendingTo = (name: string) => `Sending to ${name}…`;
export const sentTo = (name: string) => `Sent to ${name}`;
/** Under my own sent Take or answer: the chat already names the person
 *  (backend N504 item 3, signed; was "Sent to {name}"). */
export const SENT = "Sent";

export const READ_IT = "Read it";
export const HIDE_WORDS = "Hide";

/** A voice note's words, closed under its player (backend N331): "Read it"
 *  opens them inside the bubble, "Hide" closes them. Closed by default, for
 *  both people, so the voice is heard; shown only once there are words. */
export function VoiceWords({ words, mine }: { words: string; mine: boolean }) {
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

/** The slides an answer was said over, in a strip under its voice (backend
 *  N355, N333): one small tile each, the one being heard marked as the
 *  voice plays. No words and no numbers on it. */
function SlideStrip({ starts, at, mine }: { starts: readonly number[]; at: number | null; mine: boolean }) {
  let current = -1;
  if (at !== null) {
    for (let i = 0; i < starts.length; i += 1) if (starts[i] <= at) current = i;
  }
  return (
    <span data-chat-slides="" className="mt-1.5 flex flex-wrap gap-[3px]" aria-hidden>
      {starts.map((start, i) => (
        <span
          key={`${start}-${i}`}
          data-chat-slide={i === current ? "on" : ""}
          className={`block h-[26px] w-[26px] rounded-[5px] ${
            i === current ? (mine ? "bg-white" : "bg-foreground") : mine ? "bg-white/40" : "bg-[#D4D4D4]"
          }`}
        />
      ))}
    </span>
  );
}

/** A voice note (N321 item 2), in the same bubble: the plan's small player
 *  (play, the drawn bars, the length), its time bottom right, and its words
 *  behind "Read it" once they are ready (N331). */
function ChatVoice({ chatId, message, time }: { chatId: string; message: ChatMessage; time: string }) {
  const ms = typeof message.meta?.duration_ms === "number" ? message.meta.duration_ms : null;
  const words = typeof message.words === "string" && message.words.trim() ? message.words : null;
  const slides = message.meta?.answer === true && Array.isArray(message.slides) ? message.slides : [];
  const [at, setAt] = useState<number | null>(null);
  const player = (
    <VoicePlayer
      src={chatVoiceSrc(chatId, message.id)}
      tone={message.mine ? "orange" : "grey"}
      durationMs={ms}
      onTime={slides.length ? setAt : undefined}
    />
  );
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
      {slides.length ? <SlideStrip starts={slides} at={at} mine={message.mine} /> : null}
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

/** A photo's or a file's bubble (N351): mine orange on the right, theirs
 *  grey on the left, its time under it on the right. */
export function FileBubble({ mine, time, children }: { mine: boolean; time: string; children: ReactNode }) {
  const body = (
    <>
      {children}
      {time ? (
        <span data-chat-time className={`mt-1 self-end px-1 text-[11px] leading-none ${mine ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
          {time}
        </span>
      ) : null}
    </>
  );
  if (mine) {
    return (
      <div data-row="me" data-bubble="" className="ml-auto flex max-w-[85%] flex-col rounded-2xl bg-primary p-1.5 pb-2 text-primary-foreground">
        {body}
      </div>
    );
  }
  return (
    <div data-row="app" className="mr-auto flex max-w-[88%]">
      <div data-bubble="" className="flex min-w-0 flex-col rounded-[16px] bg-muted p-1.5 pb-2 text-foreground">
        {body}
      </div>
    </div>
  );
}

/** A file's extension, from its own name ("PDF"); empty when it has none. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1) : "";
  return /^[a-z0-9]{1,5}$/i.test(ext) ? ext.toUpperCase() : "";
}

/** A photo (N351): tapped, it opens full size. */
function ChatPhoto({ src, mine, time, onOpen }: { src: string; mine: boolean; time: string; onOpen: (src: string) => void }) {
  return (
    <FileBubble mine={mine} time={time}>
      <button type="button" data-chat-photo={src} onClick={() => onOpen(src)} className="block overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- a photo from the chat's own route, behind the session; nothing for next/image to optimise */}
        <img src={src} alt="📷" className="block max-h-[280px] w-full max-w-[240px] object-cover" />
      </button>
    </FileBubble>
  );
}

/** A file (N351): a small tile with its extension, and its own name; no size,
 *  no other words. Tapped, the backend gives it, to keep or to open. */
function ChatFile({ src, message, time }: { src: string; message: ChatMessage; time: string }) {
  const name = message.body;
  return (
    <FileBubble mine={message.mine} time={time}>
      <a href={src} download={name || true} data-chat-file="" className="flex items-center gap-2.5 rounded-[10px] bg-black/[0.12] px-2.5 py-2">
        <span data-chat-file-ext="" className="flex h-10 w-[34px] shrink-0 items-center justify-center rounded-[5px] bg-[#E5484D] text-[9px] font-bold text-white">
          {extensionOf(name)}
        </span>
        <span className="min-w-0 break-words text-[14px] font-semibold leading-snug">{name}</span>
      </a>
    </FileBubble>
  );
}

/** A Take sent in a chat, loaded once per message and shared by the bubble
 *  and the bar (its slides are the answer's, backend N493 item 1). A failed
 *  load is forgotten, so the next look tries again. */
const takes = new Map<string, Promise<ChatTake | null>>();
export function loadChatTake(chatId: string, messageId: string): Promise<ChatTake | null> {
  const key = `${chatId}/${messageId}`;
  let pending = takes.get(key);
  if (!pending) {
    pending = fetchChatTake(chatId, messageId).then((take) => {
      if (!take) takes.delete(key);
      return take;
    });
    takes.set(key, pending);
  }
  return pending;
}

function useChatTake(chatId: string, messageId: string | null): ChatTake | null {
  const [take, setTake] = useState<ChatTake | null>(null);
  useEffect(() => {
    setTake(null);
    if (!messageId) return;
    let live = true;
    void loadChatTake(chatId, messageId).then((loaded) => {
      if (live) setTake(loaded);
    });
    return () => {
      live = false;
    };
  }, [chatId, messageId]);
  return take;
}

/** A Take's tile (backend N470): its first slide, small, with its length,
 *  "Take {n}" and the project's title. No play mark: WillpowerLab has no
 *  video, and the recording plays in the voice player (N493 item 6; was a
 *  dark frame with a white play mark). */
export function TakeTile({ meta, first }: { meta: Record<string, unknown> | null; first: string | null }) {
  const n = typeof meta?.take_index === "number" ? meta.take_index : null;
  const ms = typeof meta?.duration_ms === "number" ? meta.duration_ms : null;
  const project = typeof meta?.project_title === "string" ? meta.project_title : "";
  return (
    <span data-take-tile="" className="flex items-center gap-2.5 rounded-[10px] bg-black/[0.12] px-2 py-2">
      <span aria-hidden data-take-tile-slide="" className="relative aspect-video w-[96px] shrink-0 overflow-hidden rounded-[8px] bg-[#061a3a] text-white">
        <span className="absolute left-2 top-[9px] h-[3px] w-3 rounded-full bg-primary" />
        {first ? <span className="absolute left-2 right-2 top-4 line-clamp-2 text-[9px] font-semibold leading-tight">{first}</span> : null}
        {ms !== null ? <span className="absolute bottom-1 right-1.5 text-[10px]">{fmtClock(ms / 1000)}</span> : null}
      </span>
      <span className="flex min-w-0 flex-col">
        {n !== null ? <span className="break-words text-[14px] font-semibold leading-snug">{`${CHUNK_SHEET_COPY.historyTake} ${n}`}</span> : null}
        {project ? <span className="text-[12.5px] leading-snug opacity-80">{project}</span> : null}
      </span>
    </span>
  );
}

/** A Take sent in the chat (backend N470, N479). Mine: the tile, with "Sent"
 *  under it (N504 item 3). Theirs: "{name} sent you Take {n}", the tile, and
 *  already open, its recording and its words slide by slide; never its Ideal
 *  Text, feedback, moments or levels (N479 item 8; N504 item 1: no "Open
 *  Take" in a chat you already have). The bar asks for the answer. */
function ChatTakeBubble({
  chatId,
  message,
  time,
  name,
  sentLine,
}: {
  chatId: string;
  message: ChatMessage;
  time: string;
  name: string;
  sentLine: string;
}) {
  const take = useChatTake(chatId, message.id);
  const meta = message.meta;
  const first = take?.slides.find((slide) => slide.title)?.title ?? null;
  if (message.mine) {
    return (
      <div className="flex flex-col gap-1">
        <FileBubble mine time={time}>
          <TakeTile meta={meta} first={first} />
        </FileBubble>
        <SentLine>
          <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.6} aria-hidden />
          {sentLine}
        </SentLine>
      </div>
    );
  }
  const n = typeof meta?.take_index === "number" ? meta.take_index : null;
  const words = take ? take.slides.map((slide) => slide.words.trim()).filter(Boolean).join("\n\n") : "";
  return (
    <div data-chat-take="" className="flex flex-col gap-2">
      <FileBubble mine={false} time={time}>
        {n !== null ? <span className="px-1.5 pt-0.5 text-[15px] leading-[1.45]">{takeSentYou(firstName(message.author || name), n)}</span> : null}
        <TakeTile meta={meta} first={first} />
        {take ? (
          <span data-chat-take-open="" className="flex flex-col px-1 pt-1">
            <VoicePlayer src={take.audioUrl} tone="grey" durationMs={take.durationMs} />
            {words ? <VoiceWords words={words} mine={false} /> : null}
          </span>
        ) : null}
      </FileBubble>
    </div>
  );
}

/** A photo full size, over everything, with a close ✕ and no words (N351). */
function PhotoFull({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div data-chat-photo-full="" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element -- as in the bubble */}
      <img src={src} alt="📷" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
      <button
        type="button"
        aria-label={CHUNK_SHEET_COPY.pillClose}
        onClick={onClose}
        className="absolute right-3 top-[calc(env(safe-area-inset-top)+12px)] flex h-11 w-11 items-center justify-center rounded-full text-white"
      >
        <X className="h-6 w-6" aria-hidden />
      </button>
    </div>
  );
}

/** One message, as the Lounge draws it: theirs grey on the left, mine orange
 *  on the right, its time inside, bottom right; an emoji large, with its
 *  meaning and time under it; a voice note with its player; a photo or a
 *  file (N351). */
function ChatRow({
  chatId,
  message,
  onPhoto,
  sentLine,
  name = "",
}: {
  chatId: string;
  message: ChatMessage;
  onPhoto: (src: string) => void;
  sentLine: string;
  /** The other person, for a Take they sent ("{name} sent you Take {n}"). */
  name?: string;
}) {
  const time = clockTime(message.created_at);
  const card = message.meta?.setup_card as { rows?: { k: string; v: string }[] } | undefined;
  if (card) return <SetupCard name={firstName(name)} rows={card.rows ?? []} />;
  if (message.kind === "take") return <ChatTakeBubble chatId={chatId} message={message} time={time} name={name} sentLine={sentLine} />;
  if (message.kind === "voice") {
    const voice = <ChatVoice chatId={chatId} message={message} time={time} />;
    if (!(message.mine && message.meta?.answer === true)) return voice;
    return (
      <div className="flex flex-col gap-1">
        {voice}
        <SentLine>
          <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.6} aria-hidden />
          {sentLine}
        </SentLine>
      </div>
    );
  }
  if (message.kind === "photo") return <ChatPhoto src={chatFileSrc(chatId, message.id)} mine={message.mine} time={time} onOpen={onPhoto} />;
  if (message.kind === "file") return <ChatFile src={chatFileSrc(chatId, message.id)} message={message} time={time} />;
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

/** Above the messages of a chat made through a link, how the two are
 *  connected: for the one who joined, with a few of the owner's questions
 *  first or none (backend N496, replacing N335 item 2's line); for the
 *  owner, who joined through their link (N502 item 5). */
export function JoinedLine({ text }: { text: string }) {
  return (
    <div data-chat-joined className="max-w-[86%] self-center rounded-xl bg-muted px-3 py-2 text-center text-[13.5px] leading-snug text-foreground">
      {text}
    </div>
  );
}

/** The owner's one card once the joiner is done (backend N487 item 7):
 *  "{name}'s answers", each answer under its label. */
function SetupCard({ name, rows }: { name: string; rows: { k: string; v: string }[] }) {
  return (
    <div data-chat-setup-card="" data-row="app" className="mr-auto flex max-w-[88%] flex-col gap-1 rounded-[16px] border border-border bg-background px-3.5 py-3 text-[14.5px]">
      <span className="text-[15px] font-semibold">{answersOf(name)}</span>
      {rows.map((row) => (
        <span key={row.k}>
          <span className="font-semibold text-muted-foreground">{row.k}</span> {row.v}
        </span>
      ))}
    </div>
  );
}

/** The owner's question still waiting for the joiner's tap (backend N487
 *  item 4): the newest of their questions, unless an answer came after it.
 *  An emoji sent meanwhile leaves it waiting, its answers under the newest
 *  message (N502, the founder's pick J8). */
export function setupWaits(messages: readonly ChatMessage[] | null): { message: ChatMessage; question: SetupQuestion } | null {
  for (let i = (messages?.length ?? 0) - 1; i >= 0; i -= 1) {
    const message = messages![i];
    if (message.meta?.setup_answer) return null;
    const question = message.mine ? null : setupOf(message);
    if (question) return { message, question };
  }
  return null;
}

/** A question that takes more than one answer (N502 item 3): each tap fills
 *  an answer or empties it, in TapRow's own look; Send is in the bar. */
function PickRow({ labels, picked, onToggle }: { labels: string[]; picked: string[]; onToggle: (label: string) => void }) {
  return (
    <div data-chat-setup-picks="" className="ml-auto flex max-w-[86%] flex-wrap justify-end gap-2 pt-0.5">
      {labels.map((label) => {
        const on = picked.includes(label);
        return (
          <button
            key={label}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(label)}
            className={`min-h-[44px] max-w-full rounded-[22px] border-[1.5px] border-primary px-4 py-2.5 text-left text-[15px] font-semibold leading-snug ${
              on ? "bg-primary text-primary-foreground" : "bg-background text-primary"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** "When do you need to be ready?": the plan's month grid in a sheet, then
 *  Done (N502 item 4), for "Yes" to "Are you in a hurry?". */
function ReadyBySheet({ onDone, onClose }: { onDone: (day: string) => void; onClose: () => void }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [picked, setPicked] = useState<Date | null>(null);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={READY_BY}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col gap-3 rounded-t-[22px] bg-white px-[18px] pb-[26px] pt-2.5">
        <div className="mx-auto h-1 w-[38px] rounded bg-[#D9D9D9]" />
        <p className="text-center text-[16px] font-semibold">{READY_BY}</p>
        <MonthGrid
          large
          month={month}
          enabled={(day) => day > start}
          picked={picked}
          onPick={setPicked}
          onMonth={(step) => setMonth(new Date(month.getFullYear(), month.getMonth() + step, 1))}
        />
        <button
          type="button"
          disabled={!picked}
          onClick={() => picked && onDone(isoDay(picked))}
          className="flex h-12 items-center justify-center rounded-full bg-foreground text-[15px] font-medium text-background disabled:opacity-30"
        >
          {DONE}
        </button>
      </div>
    </div>
  );
}

/** The date sheet's words (signed, N502 item 4). */
const READY_BY = "When do you need to be ready?";
const DONE = "Done";

/** Under the joiner's answer to "Are you in a hurry?": the deadline it set
 *  ("Your deadline: {date}", signed with the plan). */
function DeadlineLine({ iso }: { iso: string }) {
  const day = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(day.getTime())) return null;
  return (
    <div data-chat-deadline="" className="max-w-[86%] self-center rounded-xl bg-muted px-3 py-1.5 text-center text-[13px] text-foreground">
      {`${PLAN_COPY.yourDeadline}: ${fmtShort(day)}`}
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

/** Their Take, when it is the newest message: it asks for an answer
 *  (backend N493 item 3). Else null. */
export function takeWaits(messages: readonly ChatMessage[] | null): ChatMessage | null {
  const newest = messages?.at(-1);
  return newest && !newest.mine && newest.kind === "take" ? newest : null;
}

/** What a Take is about, the answer's topic: its project's title, else
 *  "Take {n}". */
function takeTopic(message: ChatMessage): string {
  const project = typeof message.meta?.project_title === "string" ? message.meta.project_title.trim() : "";
  const n = typeof message.meta?.take_index === "number" ? message.meta.take_index : null;
  return project || (n !== null ? `${CHUNK_SHEET_COPY.historyTake} ${n}` : CHUNK_SHEET_COPY.historyTake);
}

/** The question "Record your answer" answers, when the other person's
 *  question is the newest message (their words, or a message the backend
 *  marks as one, N341) and Will marked it as about a product or a treatment
 *  (`meta.record_answer`, backend N361 item 1): its words, the answer's one
 *  slide (N361 item 3). Else null. */
export function answerWaits(messages: readonly ChatMessage[] | null): string | null {
  const newest = messages?.at(-1);
  if (!newest || newest.mine || newest.meta?.record_answer !== true) return null;
  if (newest.kind !== "text" && newest.meta?.question !== true) return null;
  const words = newest.kind === "text" ? newest.body : typeof newest.words === "string" ? newest.words : "";
  return words.trim() || null;
}

/** What waits for my spoken answer in this chat (N361, N483 item 3, N493
 *  item 3): their marked question, or their Take, when it is the newest
 *  message, until "Not now" leaves it (the emoji come back until the chat is
 *  opened again, and they are told nothing). A Take is answered over its
 *  own slides, by their titles, once its words have been read. */
function useAnswerWait(chatId: string, messages: readonly ChatMessage[] | null, canAnswer: boolean) {
  const newest = messages?.at(-1) ?? null;
  const [left, setLeft] = useState<string | null>(null);
  const waiting = canAnswer && newest?.id !== left ? answerWaits(messages) : null;
  const theirTake = takeWaits(messages);
  const takeAsks = canAnswer && theirTake && theirTake.id !== left ? theirTake : null;
  const take = useChatTake(chatId, takeAsks?.id ?? null);
  const topic = takeAsks ? takeTopic(takeAsks) : null;
  return {
    question: waiting ?? topic,
    slides: topic && take?.slides.length ? take.slides.map((slide) => slide.title || topic) : undefined,
    leave: () => {
      if (!newest) return;
      setLeft(newest.id);
      void declineInChat(chatId, newest.id);
    },
  };
}

/** The small line under my sent answer, right-aligned: "Sent to {name}"
 *  with a check (the prototype's `sentok`; "Sending…" is in the bar, N368). */
function SentLine({ children }: { children: ReactNode }) {
  return (
    <div data-chat-sent-line="sent" className="flex items-center gap-1.5 self-end text-[12.5px] text-foreground/80">
      {children}
    </div>
  );
}

/** The plan's black button with the red dot, in the bar's place. */
export function RecordAnswerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-chat-record-answer=""
      className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-full bg-foreground text-[15px] font-medium text-background"
    >
      <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
      {RECORD_YOUR_ANSWER}
    </button>
  );
}

/** A short sound and, where the device allows it, a small buzz on every
 *  send (backend N368 item 3). Quiet when the browser refuses either. */
let audio: AudioContext | null = null;
export function sendTick(): void {
  // The iPhone has no web vibration: in the app, its own light tap.
  if (isNativeApp()) {
    void import("@capacitor/haptics")
      .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
      .catch(() => undefined);
  } else {
    try {
      navigator.vibrate?.(12);
    } catch {
      // No buzz here.
    }
  }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio = audio ?? new Ctx();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.05, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.12);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.13);
  } catch {
    // No sound here.
  }
}

/** "Sending to {name}… {n}" with Undo, in the middle of the bar while an
 *  answer goes (backend N368 item 1, N345); "Not sent" with "Send again"
 *  when it was refused (N441 item 1). The action is a bold word in the
 *  pill, not a pill of its own (N460 item 3). */
export function SendingPill({ name, startedAt, waited, failed }: { name: string; startedAt: number; waited: boolean; failed: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (waited || failed) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [waited, failed]);
  const left = Math.max(0, Math.ceil((startedAt + UNDO_MS - now) / 1000));
  if (failed) {
    return (
      <div data-chat-sending="failed" className="flex h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-full bg-muted pl-[18px] pr-1.5 text-[14.5px]">
        <span className="min-w-0 truncate text-foreground">{NOT_SENT}</span>
        <button type="button" onClick={sendAgain} data-chat-send-again="" className="h-9 shrink-0 rounded-full px-3 text-[14.5px] font-semibold text-foreground">
          {SEND_AGAIN}
        </button>
      </div>
    );
  }
  return (
    <div data-chat-sending="" className="flex h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-full bg-muted pl-[18px] pr-1.5 text-[14.5px]">
      <span className="min-w-0 truncate tabular-nums text-foreground">
        {sendingTo(name)}
        {waited ? "" : ` ${left}`}
      </span>
      {waited ? null : (
        <button type="button" onClick={undoAnswer} data-chat-undo="" className="h-9 shrink-0 rounded-full px-3 text-[14.5px] font-semibold text-foreground">
          {UNDO}
        </button>
      )}
    </div>
  );
}

/** The bar in a chat with a person (backend N483, the locked prototype "The
 *  Bar, Clickable" v12): the "+" on the left, which asks them ("Ask
 *  {name}"), the one thing to do now in the middle (the three emoji,
 *  "Record your answer", or "Sending to {name}…"). No mic and no typing: no
 *  voice notes between people. Until it is first tapped, while nothing else
 *  is asked of you and before your first question, the "+" is a filled
 *  orange circle, still: the one orange thing in the bar (N483 item 4). Was
 *  (N368, N460 items 1 and 2): the mic on the right, orange while their
 *  words waited; the "+" opened four tiles (N351). */
function EmojiBar({
  name,
  onPlus,
  onPick,
  plusNew = false,
  middle = null,
}: {
  name: string;
  onPlus: () => void;
  onPick: (emoji: ChatEmoji) => void;
  /** The "+" orange: not tapped yet, nothing asked of you. */
  plusNew?: boolean;
  /** What stands in the middle instead of the emoji. */
  middle?: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onPlus}
        aria-label={askName(name)}
        data-chat-plus=""
        data-plus-new={plusNew ? "" : undefined}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
          plusNew ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
        }`}
      >
        <Plus className="h-5 w-5" aria-hidden />
      </button>
      {middle ?? (
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
      )}
    </>
  );
}

let localSeq = 0;

/** The link owner's question waiting in this chat (backend N487 item 4):
 *  its answers under the newest message, "Send" for the bar's middle when
 *  it takes several, and the date sheet for "Yes" to the hurry. A tap
 *  answers at once; what follows comes back and joins the thread. */
function useSetupQuestion(chatId: string, messages: ChatMessage[] | null, onSent: (sent: ChatMessage[]) => void) {
  const [picked, setPicked] = useState<string[]>([]);
  const [readyBy, setReadyBy] = useState(false);
  const setup = setupWaits(messages);
  if (!setup) return { answers: null, send: null, sheet: null };
  const { question } = setup;
  const answer = async (answers: string[], date?: string) => {
    const sent = await answerChatSetup(chatId, setup.message.id, answers, date);
    if (!sent) return;
    sendTick();
    setPicked([]);
    onSent(sent);
  };
  const yes = question.answers.at(-1) ?? "";
  const tap = (label: string) => (question.kind === "hurry" && label === yes ? setReadyBy(true) : void answer([label]));
  const toggle = (label: string) => setPicked((now) => (now.includes(label) ? now.filter((p) => p !== label) : [...now, label]));
  return {
    answers: question.multi ? (
      <PickRow labels={question.answers} picked={picked} onToggle={toggle} />
    ) : (
      <TapRow labels={question.answers} onTap={tap} dataAttr={{ "data-chat-setup": "" }} />
    ),
    send:
      question.multi && picked.length > 0 ? (
        <button
          type="button"
          data-chat-send-picked=""
          onClick={() => void answer(question.answers.filter((a) => picked.includes(a)))}
          className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-full bg-foreground text-[15px] font-medium text-background"
        >
          {SEND_PICKED}
        </button>
      ) : null,
    sheet: readyBy ? (
      <ReadyBySheet
        onClose={() => setReadyBy(false)}
        onDone={(day) => {
          setReadyBy(false);
          void answer([yes], day);
        }}
      />
    ) : null,
  };
}

export default function ChatThread({
  chat,
  open = true,
  onBack,
  onRecordAnswer,
}: {
  chat: Chat;
  /** False while the chat is pulled in from the list's right edge, or slides
   *  out: not yet (or no longer) the screen, so Back is not its own. */
  open?: boolean;
  onBack: () => void;
  onRecordAnswer?: (answer: AnswerFor) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const pending = usePendingAnswer(chat.id);
  const customer = chat.kind === "customer";
  // An answer the backend has kept joins this chat (N363).
  useEffect(
    () =>
      onAnswerSent((chatId, message) => {
        if (chatId === chat.id) {
          sendTick();
          setMessages((list) => [...(list ?? []), message]);
        }
      }),
    [chat.id],
  );
  const [through, setThrough] = useState<string | null>(null);
  const [joinedAsksFirst, setJoinedAsksFirst] = useState(false);
  const [joinedBy, setJoinedBy] = useState<string | null>(null);
  // The "+" asks them (N483 item 4): "Ask {name}"; orange until first tapped.
  const [asking, setAsking] = useState(false);
  const [plusNew, setPlusNew] = useState(() => !plusSeen() && !askedBefore());
  const [fullPhoto, setFullPhoto] = useState<string | null>(null);
  const [profile, setProfile] = useState(false);
  // Block and Report (N466): from their profile; blocked, the bar says so.
  const { setBlocked, toast, ...safety } = useBlocking(chat);
  const scrollRef = useRef<HTMLDivElement>(null);


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
      setJoinedAsksFirst(thread?.joinedAsks ?? false);
      setJoinedBy(thread?.joinedBy ?? null);
      if (thread) setBlocked(thread.blocked);
    });
    return () => {
      cancelled = true;
    };
  }, [chat.id, setBlocked]);

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
    sendTick();
    const sent = await sendChatEmoji(chat.id, emoji);
    setMessages((list) => (list ?? []).flatMap((m) => (m.id !== local.id ? [m] : sent ? [sent] : [])));
  };

  // Their question, or their Take, to answer properly: "Record your answer"
  // in the middle, "Not now" under it (N361, N483 item 3, N493 item 3).
  const answer = useAnswerWait(chat.id, messages, !!onRecordAnswer);
  const setup = useSetupQuestion(chat.id, messages, (sent) => setMessages((list) => [...(list ?? []), ...sent]));

  return (
    <div data-chat-screen className="relative flex min-h-0 flex-1 flex-col">
      {open ? <BackIsThisChats onBack={onBack} /> : null}
      <ChatTopBar chat={chat} onBack={onBack} onOpen={() => setProfile(true)} />
      {profile ? <Profile chatId={chat.id} onBack={() => setProfile(false)} safety={safety} /> : null}
      <div
        ref={scrollRef}
        data-chat-thread
        className="scrollbar-none flex flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-3 pt-4"
      >
        {/* The messages start at the bottom, by the bar (N321 item 3), close
            within a side and wider where the side changes (N469). */}
        <div data-rhythm className="mt-auto flex flex-col">
          {through ? (
            <JoinedLine text={joinedAsksFirst ? joinedAsks(through) : joinedThanks(through)} />
          ) : joinedBy ? (
            <JoinedLine text={joinedYourLink(joinedBy)} />
          ) : null}
          {messages === null ? (
            <TypingDots label="Loading" />
          ) : (
            withDays(messages).flatMap(({ day, message }) => [
              ...(day ? [<ChatDay key={`day-${message.id}`} label={day} />] : []),
              <ChatRow
                key={message.id}
                chatId={chat.id}
                message={message}
                onPhoto={setFullPhoto}
                sentLine={SENT}
                name={chat.title}
              />,
              ...(typeof (message.meta?.setup_answer as { deadline?: unknown } | undefined)?.deadline === "string"
                ? [<DeadlineLine key={`deadline-${message.id}`} iso={(message.meta!.setup_answer as { deadline: string }).deadline} />]
                : []),
            ])
          )}
          {setup.answers}
          {answer.question && !pending ? (
            <TapRow labels={[NOT_NOW]} onTap={answer.leave} dataAttr={{ "data-chat-not-now": "" }} />
          ) : null}
        </div>
      </div>
      <div data-chat-bar className="flex shrink-0 items-end gap-1 px-4 pb-2">
        {safety.blocked ? (
          <BlockedBar name={chat.title} onUnblock={safety.unblock} />
        ) : (
          <EmojiBar
            name={chat.title}
            onPlus={() => {
              markPlusSeen();
              setPlusNew(false);
              setAsking(true);
            }}
            plusNew={plusNew && !pending && !answer.question && !setup.answers}
            onPick={(emoji) => void send(emoji)}
            middle={
              setup.send ?? (pending ? (
                <SendingPill name={pending.name} startedAt={pending.startedAt} waited={pending.waited} failed={pending.failed} />
              ) : answer.question && onRecordAnswer ? (
                <RecordAnswerButton
                  onClick={() => onRecordAnswer({ chatId: chat.id, name: chat.title, question: answer.question!, customer, slides: answer.slides })}
                />
              ) : null)
            }
          />
        )}
      </div>
      {asking ? (
        <AskSheet
          name={chat.title}
          firstTime={!askedBefore()}
          onClose={() => setAsking(false)}
          onRecord={() => {
            // Always the default presentation (N483 item 4).
            setAsking(false);
            onRecordAnswer?.({ chatId: chat.id, name: chat.title, question: "", customer, asks: true });
          }}
        />
      ) : null}
      {fullPhoto ? <PhotoFull src={fullPhoto} onClose={() => setFullPhoto(null)} /> : null}
      {setup.sheet}
      {toast}
    </div>
  );
}
