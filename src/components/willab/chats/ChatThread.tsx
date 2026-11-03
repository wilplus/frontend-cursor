"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Camera, Check, ChevronLeft, File as FileIcon, ImageIcon, Mic, Plus, UserPlus, X, type LucideIcon } from "lucide-react";
import { CHUNK_SHEET_COPY } from "@/components/willab/idealEditCopy";
import RecordingBar from "@/components/willab/RecordingBar";
import TypingDots from "@/components/willab/TypingDots";
import { VoicePlayer } from "@/components/willab/plan/VoicePlayer";
import { useBackDismiss } from "@/components/willab/useBackDismiss";
import { isNativeApp } from "@/lib/auth/nativeSignIn";
import { useVoiceNote } from "@/components/willab/useVoiceNote";
import { UNDO_MS, onAnswerSent, undoAnswer, usePendingAnswer, type AnswerFor } from "@/lib/willab/chatAnswer";
import {
  CHAT_EMOJI,
  chatFileSrc,
  chatVoiceSrc,
  getChatThread,
  sendChatEmoji,
  sendChatUpload,
  sendChatVoice,
  type Chat,
  type ChatEmoji,
  type ChatMessage,
} from "@/services/api/chats";
import Profile from "./Profile";
import { AddSomeoneSheet, EMOJI_MEANING, LetterCircle, WILL_ROW_TITLE, WillMark, meaningOf } from "./ChatList";
import { photoForUpload } from "./photoForUpload";
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
/*  in the box where Will's chat has "Type here" (N306), the "+" on its left  */
/*  (N351: Photos, Camera, Files, Someone else), and the mic beside it only   */
/*  while a question waits for a voice (N341; was N321 item 2). A question    */
/*  about a product or a treatment (Will marks it, N361 item 1) takes one     */
/*  black "Record an answer" in the bar's place (N321 item 4): the recording  */
/*  screens, then "Sending to {name}…" with Undo for 5 seconds (N345), then   */
/*  the answer, with "Sent to {name}" under it (N342, N361).                  */
/*  Only the conversation shows here; no asks (N305).                         */
/* -------------------------------------------------------------------------- */

/** Will's chat, under the WillpowerLab bar: back, then his name (N322 item 4). */
/** Every chat's own top bar, full width, where the WillpowerLab bar was
 *  (backend N321 item 1, N334): back, the circle, the name, and who they are. */
function TopBar({
  circle,
  title,
  subtitle = null,
  onBack,
  onOpen = null,
}: {
  circle: ReactNode;
  title: string;
  subtitle?: string | null;
  onBack: () => void;
  /** A person's chat: their circle and name open their profile (N366). */
  onOpen?: (() => void) | null;
}) {
  const who = (
    <>
      {circle}
      <span className="flex min-w-0 flex-col text-left">
        <span data-chat-name className="truncate text-[16px] font-semibold leading-tight text-foreground">
          {title}
        </span>
        {subtitle ? <span className="truncate text-[12.5px] leading-tight text-muted-foreground">{subtitle}</span> : null}
      </span>
    </>
  );
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
      {onOpen ? (
        <button type="button" data-chat-who="" onClick={onOpen} className="flex min-w-0 items-center gap-2.5">
          {who}
        </button>
      ) : (
        <span className="flex min-w-0 items-center gap-2.5">{who}</span>
      )}
    </div>
  );
}

/** The device's Back (the iPhone's swipe, the browser's Back) closes the
 *  chat while it is the screen: one step, to the list (N378). */
function BackIsThisChats({ onBack }: { onBack: () => void }) {
  useBackDismiss(onBack);
  return null;
}

/** A person's chat's top bar: the letter circle, the name, who they are. */
function ChatTopBar({ chat, onBack, onOpen }: { chat: Chat; onBack: () => void; onOpen: () => void }) {
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

/** Will's chat's top bar, over the Lounge: his mark and his name; the
 *  WillpowerLab bar is on the list only (backend N334 item 1). It spans the
 *  Lounge's column, across its side padding. */
export function WillTopBar({ onBack }: { onBack: () => void }) {
  // The device's Back (the iPhone's swipe) is this bar's back: one step, to
  // the list, as in a person's chat (N378).
  useBackDismiss(onBack);
  return (
    <div className="-mx-4">
      <TopBar circle={<WillMark size={36} />} title={WILL_ROW_TITLE} onBack={onBack} />
    </div>
  );
}

/** The two words under a voice note's player (backend N331, signed). */
/** Signed: N321 item 4, N345 item 3, N342 item 3, N361 item 2. */
export const RECORD_AN_ANSWER = "Record an answer";
export const UNDO = "Undo";
export const sendingTo = (name: string) => `Sending to ${name}…`;
export const sentTo = (name: string, customer: boolean) =>
  customer ? `Sent to ${name} on WhatsApp` : `Sent to ${name}`;

export const READ_IT = "Read it";
export const HIDE_WORDS = "Hide";

/** The "+" (backend N337, N351, signed): its name for a screen reader, its
 *  four tiles and the quiet link that brings the bar back. */
export const addToChatWith = (name: string) => `Add to your chat with ${name}`;
export const PLUS_TILES: readonly { id: "photos" | "camera" | "files" | "someone"; label: string; color: string; Icon: LucideIcon }[] = [
  { id: "photos", label: "Photos", color: "#7C5CFF", Icon: ImageIcon },
  { id: "camera", label: "Camera", color: "#E5484D", Icon: Camera },
  { id: "files", label: "Files", color: "#2F7CF6", Icon: FileIcon },
  { id: "someone", label: "Someone else", color: "#1F9D55", Icon: UserPlus },
];
export const PLUS_CANCEL = "Cancel";

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
function FileBubble({ mine, time, children }: { mine: boolean; time: string; children: ReactNode }) {
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
}: {
  chatId: string;
  message: ChatMessage;
  onPhoto: (src: string) => void;
  sentLine: string;
}) {
  const time = clockTime(message.created_at);
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

/** The mic shows while the newest message waits for a voice (backend N341,
 *  N351): the other person's question, that is their words (people never
 *  type, N335 item 4, so words come only from a customer's request) or a
 *  message the backend marks as one (`meta.question`: each photo or file,
 *  and the voice note sent right after it, N341 item 2); or my own photo or
 *  file, until my voice note says what I need (N337). My answer, an emoji or
 *  a voice note, is then the newest, and nothing waits. */
export function micShows(messages: readonly ChatMessage[] | null): boolean {
  const newest = messages?.at(-1);
  if (!newest) return false;
  if (newest.mine) return newest.kind === "photo" || newest.kind === "file";
  return newest.kind === "text" || newest.meta?.question === true;
}

/** The question "Record an answer" answers, when the other person's question
 *  waits and Will marked it as about a product or a treatment
 *  (`meta.record_answer`, backend N361 item 1): its words, the answer's one
 *  slide (N361 item 3). Else null. */
export function answerWaits(messages: readonly ChatMessage[] | null): string | null {
  const newest = messages?.at(-1);
  if (!newest || newest.mine || newest.meta?.record_answer !== true || !micShows(messages)) return null;
  const words = newest.kind === "text" ? newest.body : typeof newest.words === "string" ? newest.words : "";
  return words.trim() || null;
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
function RecordAnswerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-chat-record-answer=""
      className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-full bg-foreground text-[15px] font-medium text-background"
    >
      <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
      {RECORD_AN_ANSWER}
    </button>
  );
}

/** The "+"'s four tiles in the bar's place, each a round colour with its
 *  name under it, and "Cancel" under the row, quiet, which brings the bar
 *  back (N351; the prototype's `attachSheet`). */
function PlusTiles({ onTile, onCancel }: { onTile: (id: (typeof PLUS_TILES)[number]["id"]) => void; onCancel: () => void }) {
  return (
    <div data-chat-tiles="" className="flex min-w-0 flex-1 flex-col gap-2 pt-2">
      <div className="grid grid-cols-4 gap-x-1.5 gap-y-2.5 px-0.5 pb-0.5 pt-1.5">
        {PLUS_TILES.map(({ id, label, color, Icon }) => (
          <button
            key={id}
            type="button"
            data-chat-tile={id}
            onClick={() => onTile(id)}
            className="flex flex-col items-center gap-1.5 py-1 text-[12.5px] font-medium text-foreground"
          >
            <i aria-hidden className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-white" style={{ background: color }}>
              <Icon className="h-6 w-6" strokeWidth={2} />
            </i>
            {label}
          </button>
        ))}
      </div>
      <button type="button" data-chat-tiles-cancel="" onClick={onCancel} className="h-[34px] w-full text-[16px] text-muted-foreground">
        {PLUS_CANCEL}
      </button>
    </div>
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
 *  answer goes (backend N368 item 1, N345). */
function SendingPill({ name, startedAt, waited }: { name: string; startedAt: number; waited: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (waited) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [waited]);
  const left = Math.max(0, Math.ceil((startedAt + UNDO_MS - now) / 1000));
  return (
    <div data-chat-sending="" className="flex h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-full bg-muted pl-[18px] pr-1.5 text-[14.5px]">
      <span className="min-w-0 truncate tabular-nums text-foreground">
        {sendingTo(name)}
        {waited ? "" : ` ${left}`}
      </span>
      {waited ? null : (
        <button type="button" onClick={undoAnswer} data-chat-undo="" className="h-9 shrink-0 rounded-full bg-background px-4 text-[14.5px] font-semibold text-foreground">
          {UNDO}
        </button>
      )}
    </div>
  );
}

/** One bar in every chat (backend N368, the locked prototype "One bar" v12):
 *  three places that never move: the "+" on the left (N351), the one thing
 *  to do now in the middle (the three emoji, Record an answer, or "Sending
 *  to {name}…"), and your voice on the right, always there, orange and
 *  pulsing while someone waits for your words. No typing outside Will's
 *  chat. Was (N341): the mic only while a question waited. */
function EmojiBar({
  name,
  onPlus,
  onPick,
  onMic,
  hot = false,
  middle = null,
}: {
  name: string;
  onPlus: () => void;
  onPick: (emoji: ChatEmoji) => void;
  onMic: (() => void) | null;
  /** Someone waits for your words: the mic is orange and pulses. */
  hot?: boolean;
  /** What stands in the middle instead of the emoji. */
  middle?: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onPlus}
        aria-label={addToChatWith(name)}
        data-chat-plus=""
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
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
      {onMic ? (
        <button
          type="button"
          onClick={onMic}
          aria-label="Voice note"
          data-chat-mic=""
          data-chat-mic-hot={hot ? "" : undefined}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
            hot ? "animate-pulse bg-[#FF640A] text-white" : "bg-muted text-foreground hover:bg-muted/70"
          }`}
        >
          <Mic className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </>
  );
}

let localSeq = 0;

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
  // The "+" (N351): its tiles in the bar's place, the add sheet, a photo full size.
  const [tiles, setTiles] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [fullPhoto, setFullPhoto] = useState<string | null>(null);
  const [profile, setProfile] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pickers = { photos: useRef<HTMLInputElement>(null), camera: useRef<HTMLInputElement>(null), files: useRef<HTMLInputElement>(null) };

  // The voice note (N321 item 2): the mic records with the one recording
  // bar, up to two minutes; Stop sends, the trash throws it away. The bar
  // comes back at once; the message joins the thread when the backend has
  // kept it. A refused mic, a failed recording or a failed send shows
  // nothing new.
  const note = useVoiceNote({
    maxSeconds: 120,
    onDone: async ({ audio, durationMs }) => {
      const sent = await sendChatVoice(chat.id, audio, durationMs);
      if (sent) {
        sendTick();
        setMessages((list) => [...(list ?? []), sent]);
      }
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

  // A tile: the bar comes back at once, and the browser's own picker opens
  // (Photos, Camera, Files), or the add sheet (Someone else). We draw no
  // picker of our own.
  const tile = (id: (typeof PLUS_TILES)[number]["id"]) => {
    setTiles(false);
    if (id === "someone") setInviting(true);
    else pickers[id].current?.click();
  };

  // What was picked goes, one by one, in order; each joins the thread once
  // the backend has kept it. A refused picker, a failed send or a file too
  // big shows nothing new.
  const upload = (kind: "photo" | "file") => async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of picked) {
      const { blob, name } = kind === "photo" ? await photoForUpload(file) : { blob: file, name: file.name };
      const sent = await sendChatUpload(chat.id, kind, blob, name);
      if (sent) {
        sendTick();
        setMessages((list) => [...(list ?? []), sent]);
      }
    }
  };

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

  const question = answerWaits(messages);

  return (
    <div data-chat-screen className="relative flex min-h-0 flex-1 flex-col">
      {open ? <BackIsThisChats onBack={onBack} /> : null}
      <ChatTopBar chat={chat} onBack={onBack} onOpen={() => setProfile(true)} />
      {profile ? <Profile chatId={chat.id} onBack={() => setProfile(false)} /> : null}
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
              <ChatRow
                key={message.id}
                chatId={chat.id}
                message={message}
                onPhoto={setFullPhoto}
                sentLine={sentTo(chat.title, customer)}
              />,
            ])
          )}
        </div>
      </div>
      <div data-chat-bar className="flex shrink-0 items-end gap-1 px-4 pb-2">
        {note.phase === "recording" ? (
          <div className="min-w-0 flex-1">
            <RecordingBar elapsedMs={note.elapsedMs} onTrash={note.cancel} onStop={note.send} />
          </div>
        ) : tiles ? (
          <PlusTiles onTile={tile} onCancel={() => setTiles(false)} />
        ) : (
          <EmojiBar
            name={chat.title}
            onPlus={() => setTiles(true)}
            onPick={(emoji) => void send(emoji)}
            onMic={pending ? null : () => void note.start()}
            hot={micShows(messages) && !pending}
            middle={
              pending ? (
                <SendingPill name={pending.name} startedAt={pending.startedAt} waited={pending.waited} />
              ) : question && onRecordAnswer ? (
                <RecordAnswerButton onClick={() => onRecordAnswer({ chatId: chat.id, name: chat.title, question, customer })} />
              ) : null
            }
          />
        )}
      </div>
      {/* The browser's own pickers (N351), kept mounted while the bar is back. */}
      <input ref={pickers.photos} type="file" accept="image/*" multiple hidden data-chat-pick="photos" onChange={(e) => void upload("photo")(e)} />
      <input ref={pickers.camera} type="file" accept="image/*" capture="environment" hidden data-chat-pick="camera" onChange={(e) => void upload("photo")(e)} />
      <input ref={pickers.files} type="file" hidden data-chat-pick="files" onChange={(e) => void upload("file")(e)} />
      {inviting ? <AddSomeoneSheet onClose={() => setInviting(false)} /> : null}
      {fullPhoto ? <PhotoFull src={fullPhoto} onClose={() => setFullPhoto(null)} /> : null}
    </div>
  );
}
