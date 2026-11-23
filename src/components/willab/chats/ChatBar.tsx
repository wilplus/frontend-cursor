"use client";

import { PLAN_COPY } from "@/lib/willab/planCopy";
import type { AnswerWith } from "@/services/api/assistants";
import type { ChatEmoji, ChatMessage } from "@/services/api/chats";
import type { SendKind } from "@/services/api/hostSetup";
import { EMOJI_MEANING } from "./ChatList";

export const RECORD_YOUR_ANSWER = PLAN_COPY.recordAnswer;
export const RECORD_YOUR_QUESTION = "Record your question";
export const SEND_A_FILE = "Send a file";
export const SEND_A_PHOTO = "Send a photo";

/** How a chat takes what you send. `tap`, `type` and `record` are the host's
 *  answer_with. `photo` and `file` are additional attachment formats. */
export type Takes = AnswerWith & { photo: boolean; file: boolean };
/** A chat with no host, and a host whose read has no `send`: recordings and
 *  taps with photos. */
export const PEOPLE_TAKE: Takes = { tap: true, type: false, record: true, photo: true, file: false };

/** What a chat takes from answer_with alone. Typing is on where the host
 *  chose it; a chat with no host, or a backend without the host's route
 *  (404), has none. Photo stays behind the "+", as the locked bar has it;
 *  a file does not, until They send says so. */
export function takesOf(answerWith: AnswerWith | null): Takes {
  const base = answerWith ?? { tap: true, type: false, record: true };
  return { tap: base.tap, type: base.type, record: base.record, photo: true, file: false };
}

const SEND_KIND: readonly SendKind[] = ["rec", "text", "photo", "file"];

/** They send, as the recipe stores it (`rec` a recording, `text` typing,
 *  `photo` and `file` behind the "+"). Null when the read has no `send`,
 *  so the caller keeps answer_with. An empty list takes none of the four.
 *  Taps stay on: a question's answers are not one of these four. */
export function takesFromSend(send: readonly string[] | null | undefined): Takes | null {
  if (!send) return null;
  const has = (kind: SendKind) => send.includes(kind);
  return { tap: true, record: has("rec"), type: has("text"), photo: has("photo"), file: has("file") };
}

/** The bar for one chat: They send when the read has it, otherwise answer_with. */
export function takesFor(send: readonly string[] | null | undefined, answerWith: AnswerWith | null): Takes {
  return takesFromSend(send) ?? takesOf(answerWith);
}

/** Every non-empty combination of the four kinds, in a stable order. */
export function sendCombos(): SendKind[][] {
  const out: SendKind[][] = [];
  for (let mask = 1; mask < 1 << SEND_KIND.length; mask += 1) {
    out.push(SEND_KIND.filter((_, i) => (mask & (1 << i)) !== 0));
  }
  return out;
}

/** Permissions for the three slots, including the legacy voice question. */
export function composerModes(takes: Takes, asked: { answer: boolean; photo: boolean }, legacy = false) {
  return {
    text: takes.type && !asked.photo,
    mic: !asked.photo && (takes.record || legacy && !takes.type && !asked.answer),
    photo: takes.photo || asked.photo,
    file: takes.file && !asked.photo,
  };
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
export function thanksDue(takes: Pick<Takes, "type">, messages: readonly ChatMessage[] | null, held: readonly unknown[]): boolean {
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
