"use client";

import type { ReactNode } from "react";
import { Pin } from "lucide-react";
import type { Chat, ChatEmoji, ChatLast } from "@/services/api/chats";
import { chatIsNew } from "./chatOpened";
import { listTime, timeOf } from "./chatTime";

/* -------------------------------------------------------------------------- */
/*  The list of chats (backend N256, N274, N298, N321, N322; rules:            */
/*  docs/flows/customer-requests.md §1 C1), one WhatsApp row each: Will        */
/*  pinned on top with his mark, then each chat, newest first, with the first */
/*  letter of the name in a circle (no photo, N301, N322 item 1), the name and */
/*  who they are, the time, and the last message on one line. A new message   */
/*  shows bold with an orange dot; no number, ever.                           */
/* -------------------------------------------------------------------------- */

/** Will's chat is the Lounge; its row carries his mark, his name and a pin. */
export const WILL_ROW_TITLE = "Will";

/** Signed in N322 item 3 (Never 4): the list's line after a voice note. */
export const VOICE_MESSAGE_LINE = "🎤 Voice message";

/** One meaning per emoji, everywhere; a sent emoji shows it under itself
 *  (N311 item 1, signed). */
export const EMOJI_MEANING: Record<ChatEmoji, string> = {
  "👍": "It's good",
  "👀": "Seen, I'll answer",
  "🙏": "Thanks",
};

/** An emoji's meaning; null for one that has none. */
export function meaningOf(body: string): string | null {
  return (EMOJI_MEANING as Record<string, string>)[body] ?? null;
}

/** The circles' tints: soft background, dark letter. One per chat, from its
 *  id, so a chat keeps its colour. */
const TINTS = [
  { bg: "#FFE9DB", fg: "#A33A00" },
  { bg: "#E4EDFB", fg: "#1E4C99" },
  { bg: "#E3F3E8", fg: "#1D6B3A" },
  { bg: "#F1E6FB", fg: "#5E2A99" },
  { bg: "#FBE4EC", fg: "#992A52" },
] as const;

function tintOf(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}

/** A circle with the first letter of the name. */
export function LetterCircle({ id, name, size }: { id: string; name: string; size: 36 | 48 }) {
  const tint = tintOf(id);
  return (
    <span
      aria-hidden
      data-chat-letter=""
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold leading-none ${
        size === 48 ? "h-12 w-12 text-[20px]" : "h-9 w-9 text-[15px]"
      }`}
      style={{ background: tint.bg, color: tint.fg }}
    >
      {(Array.from(name.trim())[0] ?? "").toUpperCase()}
    </span>
  );
}

/** Will's mark: the logo's three dots, the middle one bigger; 48px in the
 *  list, 36px in his chat's top bar (backend N334). */
export function WillMark({ size = 48 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center gap-[3px] rounded-full bg-muted"
      style={{ width: size, height: size }}
    >
      <i className="h-[5px] w-[5px] rounded-full bg-foreground" />
      <i className="h-[7px] w-[7px] rounded-full bg-foreground" />
      <i className="h-[5px] w-[5px] rounded-full bg-foreground" />
    </span>
  );
}

/** The last message on one line: its words, the emoji with its meaning, or
 *  the voice note's line. */
export function lastLine(last: ChatLast | null): string {
  if (!last) return "";
  if (last.kind === "voice") return VOICE_MESSAGE_LINE;
  if (last.kind === "emoji") {
    const meaning = meaningOf(last.body);
    return meaning ? `${last.body} ${meaning}` : last.body;
  }
  return last.body;
}

function ChatListRow({
  id,
  circle,
  title,
  subtitle = null,
  time = "",
  preview = "",
  isNew = false,
  pinned = false,
  onOpen,
}: {
  id: string;
  circle: ReactNode;
  title: string;
  subtitle?: string | null;
  time?: string;
  preview?: string;
  isNew?: boolean;
  pinned?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      data-chat-row={id}
      data-chat-new={isNew ? "" : undefined}
      onClick={onOpen}
      className="flex h-[76px] w-full shrink-0 items-center gap-3 pl-4 text-left transition-colors hover:bg-muted/50"
    >
      {circle}
      <span className="flex h-full min-w-0 flex-1 flex-col justify-center gap-[3px] border-b border-[#F0F0F0] pr-4">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className={`max-w-full shrink-0 truncate text-[16px] leading-snug text-foreground ${isNew ? "font-bold" : "font-semibold"}`}>
              {title}
            </span>
            {subtitle ? <span className="min-w-0 truncate text-[12.5px] leading-snug text-muted-foreground">{subtitle}</span> : null}
          </span>
          {time ? (
            <span className={`shrink-0 text-[12px] leading-snug ${isNew ? "font-semibold text-[#C2410C]" : "text-muted-foreground"}`}>{time}</span>
          ) : null}
        </span>
        <span className="flex min-h-[20px] min-w-0 items-center gap-2">
          <span data-chat-last className={`min-w-0 flex-1 truncate text-[14px] leading-snug ${isNew ? "text-foreground" : "text-muted-foreground"}`}>
            {preview}
          </span>
          {isNew ? (
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
          ) : pinned ? (
            <Pin aria-hidden className="h-[15px] w-[15px] shrink-0 text-[#A3A3A3]" />
          ) : null}
        </span>
      </span>
    </button>
  );
}

/** Newest last message first; a chat with none goes last. */
function newestFirst(chats: readonly Chat[]): Chat[] {
  const at = (chat: Chat) => timeOf(chat.last?.created_at) ?? -Infinity;
  return [...chats].sort((a, b) => at(b) - at(a));
}

export default function ChatList({
  chats,
  onOpenWill,
  onOpen,
}: {
  chats: readonly Chat[];
  onOpenWill: () => void;
  onOpen: (chat: Chat) => void;
}) {
  const now = new Date();
  return (
    <div data-chat-list className="scrollbar-none flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <ChatListRow id="will" circle={<WillMark />} title={WILL_ROW_TITLE} pinned onOpen={onOpenWill} />
      {newestFirst(chats).map((chat) => (
        <ChatListRow
          key={chat.id}
          id={chat.id}
          circle={<LetterCircle id={chat.id} name={chat.title} size={48} />}
          title={chat.title}
          subtitle={chat.subtitle}
          time={listTime(chat.last?.created_at, now)}
          preview={lastLine(chat.last)}
          isNew={chatIsNew(chat)}
          onOpen={() => onOpen(chat)}
        />
      ))}
    </div>
  );
}
