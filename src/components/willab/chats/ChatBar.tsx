"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Image as ImageIcon, Plus } from "lucide-react";
import { TYPE_YOUR_ANSWER } from "@/components/willab/WillQuestion";
import { PLAN_COPY } from "@/lib/willab/planCopy";
import type { AnswerWith } from "@/services/api/assistants";
import type { ChatEmoji, ChatMessage } from "@/services/api/chats";
import { askName } from "./AskSheet";
import { EMOJI_MEANING } from "./ChatList";

/* -------------------------------------------------------------------------- */
/*  The bar in a host's chat and in a chat between people (backend N610, the  */
/*  locked page "The Bar, To Lock", docs/design/the-bar-2026-11-10/): two     */
/*  places, always the same. The "+" on the left, which never moves, and the  */
/*  one thing to do now in the middle: a black button records, a box types.   */
/*  Nothing else sits in the bar, and the middle is never grey or disabled.   */
/*                                                                            */
/*    nothing asked   the middle asks: "Ask {name}", a button where the chat  */
/*                    takes recordings, a box where it takes typing (both     */
/*                    on: the box).                                           */
/*    the chat asks   the middle answers: "Record your answer" where it takes */
/*                    recordings ("Type your answer" is then behind "+" where */
/*                    typing is on too); the box "Type your answer" where it  */
/*                    takes only typing; where it takes only taps the middle  */
/*                    stays "Ask {name}". Answers to tap sit above the bar,   */
/*                    "Not now" under them.                                   */
/*    a photo asked   the middle is "Add a photo".                            */
/*    thanks          after a person's answer in a chat without typing, three */
/*                    taps above the bar (👀, 👍 and 🙏, the last filled,     */
/*                    nearest the thumb); one tap sends it and they go.       */
/*                                                                            */
/*  Will's chat keeps its own bar (N369) and the recording strip is as locked */
/*  (N483, RecordingBar.tsx: the bin in the "+"'s place while you record).    */
/* -------------------------------------------------------------------------- */

/** Signed (backend N610 item 7; "Record your answer", "Type your answer"
 *  and "Ask {name}" were signed before). */
export const RECORD_YOUR_ANSWER = PLAN_COPY.recordAnswer;
export const ADD_A_PHOTO = "Add a photo";
/** The "+"'s own name, for a screen reader (the locked page's label). */
export const PLUS_LABEL = "Add";
export { TYPE_YOUR_ANSWER };

/** How a chat takes what you send. A chat with no host takes recordings and
 *  taps, as it always has; a host's chat follows the host's answer_with. */
export type Takes = AnswerWith;
export const PEOPLE_TAKE: Takes = { tap: true, type: false, record: true };

/** What a chat takes: the host's answer_with (GET /v2/chats/<id>/host).
 *  Typing is on where the host chose it; a chat with no host, or a backend
 *  without the host's route (404), has none. */
export function takesOf(answerWith: AnswerWith | null): Takes {
  return answerWith ?? PEOPLE_TAKE;
}

/** The one thing in the middle (N610 items 2 to 4). */
export type Middle = "ask" | "ask-box" | "record-answer" | "answer-box" | "add-photo";

/** `answer`: a question or a Take that takes a recorded answer waits;
 *  `taps`: a question with answers to tap waits, which typed words answer
 *  too, but a recording does not. */
export function middleOf(takes: Takes, asked: { answer: boolean; taps: boolean; photo: boolean }): Middle {
  if (asked.photo) return "add-photo";
  if (asked.answer && takes.record) return "record-answer";
  if ((asked.answer || asked.taps) && takes.type) return "answer-box";
  return takes.type ? "ask-box" : "ask";
}

/** The question that asks for a photo and still waits (its message has
 *  `meta.setup.kind === "photo"`, backend #1880): the newest of their
 *  questions, unless an answer or a photo of mine came after it. */
export function photoWaits(messages: readonly ChatMessage[] | null): ChatMessage | null {
  for (let i = (messages?.length ?? 0) - 1; i >= 0; i -= 1) {
    const message = messages![i];
    if (message.meta?.setup_answer || (message.mine && message.kind === "photo")) return null;
    const setup = message.mine ? undefined : (message.meta?.setup as { kind?: unknown } | undefined);
    if (setup) return setup.kind === "photo" ? message : null;
  }
  return null;
}

/** The answer a thanks is for (N610 item 5): their newest message, when a
 *  person recorded it as an answer. Never Will's or a machine's (the
 *  assistant's own messages), and never twice: my thanks is then the newest
 *  message, so the taps go. */
export function thanksFor(messages: readonly ChatMessage[] | null): ChatMessage | null {
  const newest = messages?.at(-1);
  if (!newest || newest.mine || newest.kind !== "voice") return null;
  if (newest.meta?.answer !== true || newest.meta?.assistant === true) return null;
  return newest;
}

/** Whether the three thanks show: a person's answer is the newest message,
 *  the chat takes no typing (there you type your thanks), and nothing else
 *  holds the bar (`held`: something asked, an answer going, a block). */
export function thanksDue(takes: Takes, messages: readonly ChatMessage[] | null, held: readonly unknown[]): boolean {
  return !takes.type && !held.some(Boolean) && thanksFor(messages) !== null;
}

/** The thanks, in the page's order: 🙏 last, nearest the thumb. */
export const THANKS: readonly ChatEmoji[] = ["👀", "👍", "🙏"];

/** The three taps above the bar, on my side; the last one filled. */
export function ThanksTaps({ onPick }: { onPick: (emoji: ChatEmoji) => void }) {
  return (
    <div data-chat-thanks="" className="mt-2 flex items-center justify-end gap-1.5">
      {THANKS.map((emoji, i) => (
        <button
          key={emoji}
          type="button"
          aria-label={EMOJI_MEANING[emoji]}
          data-goes={i === THANKS.length - 1 ? "" : undefined}
          onClick={() => onPick(emoji)}
          className={`min-h-[44px] rounded-[18px] border-[1.5px] border-primary px-3 text-[20px] leading-[1.3] ${
            i === THANKS.length - 1 ? "bg-primary" : "bg-background"
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/** The "+", always in its place. Orange until first tapped, while nothing
 *  is asked of you and before your first question (N483 item 4). */
export function BarPlus({ onClick, fresh }: { onClick: () => void; fresh: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={PLUS_LABEL}
      data-chat-plus=""
      data-plus-new={fresh ? "" : undefined}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
        fresh ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
      }`}
    >
      <Plus className="h-5 w-5" aria-hidden />
    </button>
  );
}

/** The black button in the middle: 44px, the whole width. With the red dot
 *  it records; "Ask {name}" has none; "Add a photo" has the picture. */
export function BarButton({
  label,
  mark,
  onClick,
  dataAttr,
}: {
  label: string;
  mark?: "dot" | "photo";
  onClick: () => void;
  dataAttr: Record<string, string>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...dataAttr}
      className="flex h-11 min-w-0 flex-1 items-center justify-center gap-[9px] whitespace-nowrap rounded-full bg-[#121212] text-[14px] font-medium text-white"
    >
      {mark === "dot" ? <span className="h-[9px] w-[9px] rounded-full bg-red-500" aria-hidden /> : null}
      {mark === "photo" ? <ImageIcon className="h-[17px] w-[17px]" aria-hidden /> : null}
      {label}
    </button>
  );
}

/** The box in the middle: its words are the one thing to do ("Ask {name}",
 *  "Type your answer"); the keyboard's own key sends. Nothing beside it:
 *  the bar has two places. Typed words are never lost: a send the backend
 *  refuses, or one that fails, puts them back in the box as typed, the
 *  caret in it. */
export function BarBox({
  hint,
  open = false,
  onSend,
  onLeave,
}: {
  hint: string;
  /** Opened from the "+": the caret is in it at once. */
  open?: boolean;
  /** True once the backend kept the words. */
  onSend: (words: string) => Promise<boolean>;
  /** Left empty: the middle goes back to what it was. */
  onLeave?: () => void;
}) {
  const [words, setWords] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  // Words on their way: the box is empty, but not left.
  const going = useRef(false);
  const send = async (typed: string) => {
    going.current = true;
    setWords("");
    const kept = await onSend(typed);
    going.current = false;
    if (kept) return;
    // Back as typed, unless new words are already there.
    setWords((now) => now || typed);
    ref.current?.focus();
  };
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  return (
    <form
      data-chat-box=""
      className="flex min-w-0 flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (words.trim() && !going.current) void send(words);
      }}
    >
      <input
        ref={ref}
        type="text"
        value={words}
        onChange={(e) => setWords(e.target.value)}
        onBlur={() => {
          if (!words.trim() && !going.current) onLeave?.();
        }}
        placeholder={hint}
        aria-label={hint}
        enterKeyHint="send"
        autoComplete="off"
        className="h-10 w-full min-w-0 rounded-[22px] border border-[#E8E8E8] bg-background px-3 text-[14px] text-[#121212] caret-primary outline-none placeholder:text-[#A3A3A3] focus:border-primary"
      />
    </form>
  );
}

/** "Add a photo" and "Send a photo" open the device's own picker; the
 *  photo picked goes at once. */
export function usePhotoPicker(onPhoto: (photo: File) => void): { pick: () => void; input: ReactNode } {
  const ref = useRef<HTMLInputElement>(null);
  return {
    pick: () => ref.current?.click(),
    input: (
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        data-chat-photo-pick=""
        onChange={(e) => {
          const photo = e.target.files?.[0];
          e.target.value = "";
          if (photo) onPhoto(photo);
        }}
      />
    ),
  };
}

/** The middle, drawn. */
export function BarMiddle({
  middle,
  name,
  typing,
  onAsk,
  onRecordAnswer,
  onPhoto,
  onType,
  onTypingDone,
}: {
  middle: Middle;
  name: string;
  /** "Type your answer" was picked behind the "+": the box, for now. */
  typing: boolean;
  onAsk: () => void;
  onRecordAnswer: () => void;
  onPhoto: () => void;
  onType: (words: string) => Promise<boolean>;
  onTypingDone: () => void;
}) {
  if (typing) {
    return (
      <BarBox
        hint={TYPE_YOUR_ANSWER}
        open
        onSend={async (words) => {
          // Sent: the button comes back. Refused: the box stays, with the words.
          const kept = await onType(words);
          if (kept) onTypingDone();
          return kept;
        }}
        onLeave={onTypingDone}
      />
    );
  }
  if (middle === "add-photo") return <BarButton label={ADD_A_PHOTO} mark="photo" onClick={onPhoto} dataAttr={{ "data-chat-add-photo": "" }} />;
  if (middle === "record-answer") {
    return <BarButton label={RECORD_YOUR_ANSWER} mark="dot" onClick={onRecordAnswer} dataAttr={{ "data-chat-record-answer": "" }} />;
  }
  if (middle === "answer-box") return <BarBox hint={TYPE_YOUR_ANSWER} onSend={onType} />;
  if (middle === "ask-box") return <BarBox hint={askName(name)} onSend={onType} />;
  return <BarButton label={askName(name)} onClick={onAsk} dataAttr={{ "data-chat-ask": "" }} />;
}
