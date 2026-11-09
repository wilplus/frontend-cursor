"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Link as LinkIcon, Pin, Plus, X } from "lucide-react";
import { beginJoinSetup, joinQuestionsSet, type Chat, type ChatEmoji, type ChatLast } from "@/services/api/chats";
import type { LoungeKind, LoungeMessage } from "@/services/api/loungeMessages";
import { useLoungeThreadMaybe } from "../LoungeThreadContext";
import { chatIsNew, isNewSince, markChatOpened } from "./chatOpened";
import { listTime, timeOf } from "./chatTime";
import { ADD_SHEET_TITLE, SETUP_NOTE, SET_THEM, answersOf, asksYouAbout, joinedThanks } from "./joinCopy";
import { AddSomeoneSheet } from "./AddSomeoneSheet";

/* -------------------------------------------------------------------------- */
/*  The list of chats (backend N256, N274, N298, N321, N322; rules:            */
/*  docs/flows/customer-requests.md §1 C1), one WhatsApp row each: Will        */
/*  pinned on top with his mark, then each chat, newest first, with the first */
/*  letter of the name in a circle (no photo, N301, N322 item 1), the name and */
/*  who they are, the time, and the last message on one line. A new message,  */
/*  an emoji from the other person included, has the look locked for the      */
/*  whole app (N500): the name bold, the time orange, the line bold and       */
/*  orange, the orange dot; no number, ever. Will is always the first  */
/*  row (N360). Just joined through a link, the chat with the one who invited */
/*  you is right under Will (under the coach's row when there is one, N521), new until opened, its line theirs or "You joined */
/*  through…" (N357), kept until the chat's first message (N488). Will's row shows his newest line, bold with the dot     */
/*  until his chat is open (N457 item 2).                                     */
/* -------------------------------------------------------------------------- */

/** Will's chat is the Lounge; its row carries his mark, his name and a pin. */
export const WILL_ROW_TITLE = "Will";

/** Signed in N322 item 3 (Never 4): the list's line after a voice note. */
export const VOICE_MESSAGE_LINE = "🎤 Voice message";

/** The list's line after a photo, and after a file, with the file's own
 *  name (N351): an emoji and the person's own words, no word of ours. */
export const PHOTO_LINE = "📷";
export const fileLine = (name: string) => `📄 ${name}`;

/** A Take sent in a chat (backend N470 item 6, signed): the receiver's line
 *  in the bubble and in the list, and the bubble's button. */
export const takeSentYou = (name: string, n: number) => `${name} sent you Take ${n}`;
export const OPEN_TAKE = "Open Take";

/** A person's first name, as "{name} sent you Take {n}" says it. */
export function firstName(name: string): string {
  // A website visitor's chat is "Widget / Visitor 7" or, once kept,
  // "Widget / Anna": their name is what follows (backend N569 item 6).
  const visitor = /^Widget \/ (.+)$/.exec(name.trim());
  if (visitor) return visitor[1];
  return name.trim().split(/\s+/)[0] ?? "";
}

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

/** The assistant's mark (backend N578 item 1, N580 items 1 and 3): Will's
 *  three dots, small, on the bottom of a person's circle, because Will's
 *  engine answers for them there. It says plainly that an AI answers in that
 *  chat (AI Act article 50); drawn only where the backend names the
 *  assistant, which it does for the chat builder's ring alone (N579 item 2). */
/** `inline`: beside the name written out (the join page), so it is only drawn. */
export function AssistantMark({ label, inline = false }: { label: string; inline?: boolean }) {
  return (
    <span
      {...(inline ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
      data-assistant-mark=""
      className={`${inline ? "relative" : "absolute -bottom-0.5 -right-0.5"} flex shrink-0 h-[18px] w-[18px] items-center justify-center gap-[1.5px] rounded-full border-2 border-background bg-muted`}
    >
      <i className="h-[2.5px] w-[2.5px] rounded-full bg-foreground" />
      <i className="h-[3.5px] w-[3.5px] rounded-full bg-foreground" />
      <i className="h-[2.5px] w-[2.5px] rounded-full bg-foreground" />
    </span>
  );
}

/** A person's circle, with the assistant's mark when one answers for them. */
export function PersonCircle({ id, name, size, assistant = null }: { id: string; name: string; size: 36 | 48; assistant?: string | null }) {
  if (!assistant) return <LetterCircle id={id} name={name} size={size} />;
  return (
    <span className="relative shrink-0">
      <LetterCircle id={id} name={name} size={size} />
      <AssistantMark label={assistant} />
    </span>
  );
}

/** Who the row says the person is: their own line, then, with the chat
 *  builder's ring, whose assistant answers there (N580 item 1). */
export function subtitleOf(chat: Pick<Chat, "subtitle" | "assistant">): string | null {
  const parts = [chat.subtitle, chat.assistant].filter((part): part is string => typeof part === "string" && part.trim() !== "");
  return parts.length ? parts.join(" · ") : null;
}

/** The last message on one line: its words, the emoji with its meaning, or
 *  the voice note's, the photo's or the file's line. */
export function lastLine(last: ChatLast | null, name = ""): string {
  if (!last) return "";
  // The owner's card once the joiner is done (backend N487 item 7).
  if (last.meta?.setup_card) return answersOf(firstName(name));
  if (last.kind === "take") {
    // A Take sent to you: "{name} sent you Take {n}" (N470); yours: "Take {n}".
    const n = typeof last.meta?.take_index === "number" ? last.meta.take_index : null;
    if (n === null) return last.body;
    return last.mine === true || !name ? `Take ${n}` : takeSentYou(firstName(name), n);
  }
  if (last.kind === "voice") return VOICE_MESSAGE_LINE;
  if (last.kind === "photo") return PHOTO_LINE;
  if (last.kind === "file") return fileLine(last.body);
  if (last.kind === "emoji") {
    const meaning = meaningOf(last.body);
    return meaning ? `${last.body} ${meaning}` : last.body;
  }
  return last.body;
}

export function ChatListRow({
  id,
  circle,
  title,
  subtitle = null,
  time = "",
  preview = "",
  isNew = false,
  pinned = false,
  cameFrom = false,
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
  /** Just come back from this chat: lit for a moment (backend N378 item 5). */
  cameFrom?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      data-chat-row={id}
      data-chat-new={isNew ? "" : undefined}
      data-chat-came-from={cameFrom ? "" : undefined}
      onClick={onOpen}
      className="relative isolate flex h-[76px] w-full shrink-0 items-center gap-3 pl-4 text-left transition-colors hover:bg-muted/50"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-muted transition-opacity duration-700"
        style={{ opacity: cameFrom ? 1 : 0 }}
      />
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
          <span data-chat-last className={`min-w-0 flex-1 truncate text-[14px] leading-snug ${isNew ? "font-bold text-[#C2410C]" : "text-muted-foreground"}`}>
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

/** "Add someone to chat with" (backend N503, N534): until the questions for
 *  people who join are set, the note at the bottom; once set, or where they
 *  can't be kept, the add sheet. */
function useAddSomeone(setAdding: (open: boolean | "note") => void): () => void {
  const thread = useLoungeThreadMaybe();
  return () => {
    if (!thread) return setAdding(true);
    void joinQuestionsSet().then((set) => setAdding(set ? true : "note"));
  };
}

/** The "+"'s note (backend N534): the bar at the top of Will's chat
 *  (NoticeBar.tsx, N391), at the bottom. "Set them" opens Will's setup in his
 *  chat; ✕ is Not now. */
function SetupNote({ onClose, onOpenWill, onLink }: { onClose: () => void; onOpenWill: () => void; onLink: () => void }) {
  const thread = useLoungeThreadMaybe();
  const setThem = () => {
    onClose();
    void beginJoinSetup().then((started) => {
      if (!started) return onLink();
      // Will's chat reads its thread again, his first lines at the bottom.
      void thread?.reload().catch(() => undefined);
      onOpenWill();
    });
  };
  return (
    <div
      role="status"
      data-setup-note=""
      className="absolute inset-x-2.5 bottom-5 z-30 flex items-center gap-1 rounded-2xl border border-border bg-background py-1.5 pl-3 pr-1 shadow-md"
    >
      <button type="button" onClick={setThem} className="flex min-h-[52px] flex-1 items-center gap-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-muted">
          <LinkIcon className="h-5 w-5" aria-hidden />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold leading-snug text-foreground">{SETUP_NOTE}</span>
          <span className="mt-1 self-start rounded-full bg-primary px-4 py-2 text-[15px] font-semibold text-primary-foreground">
            {SET_THEM}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label="Not now"
        onClick={onClose}
        className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground"
      >
        <X className="h-[18px] w-[18px]" aria-hidden />
      </button>
    </div>
  );
}


/** Will's chat in the list's per-chat "opened" store. */
const WILL_CHAT = "will";

/** The kinds of Will's chat that read as a line on his row; cards, steps
 *  and statuses do not. */
const WILL_LINE_KINDS: ReadonlySet<LoungeKind> = new Set<LoungeKind>(["text", "joke", "cadence"]);

/** Will's newest line, or his newest message's when it is one of yours. */
export function willNewest(messages: readonly LoungeMessage[]): LoungeMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "system" && WILL_LINE_KINDS.has(message.kind) && message.body.trim()) return message;
  }
  return null;
}

/** Will's row (backend N457 item 2): his chat's newest line, read from the
 *  Lounge's thread underneath, and new while it is his and came after his
 *  chat was last open on this device. Open, or just come back from, it is
 *  seen. Outside the Lounge's thread the row is as it was: no line. */
function useWillRow(willOpen: boolean, back: boolean): { preview: string; isNew: boolean } {
  const thread = useLoungeThreadMaybe();
  const newest = willNewest(thread?.messages ?? []);
  const at = newest?.client_created_at ?? null;
  const seeing = willOpen || back;
  useEffect(() => {
    if (seeing) markChatOpened(WILL_CHAT, at);
  }, [seeing, at]);
  return {
    preview: newest?.body.trim() ?? "",
    isNew: !seeing && newest?.role === "bot" && isNewSince(WILL_CHAT, at),
  };
}

/** Newest last message first; a chat with none goes last. */
function newestFirst(chats: readonly Chat[]): Chat[] {
  const at = (chat: Chat) => timeOf(chat.last?.created_at) ?? -Infinity;
  return [...chats].sort((a, b) => at(b) - at(a));
}

export default function ChatList({
  chats,
  joined = null,
  cameFrom = null,
  willOpen = false,
  coachRow = null,
  modelsRows = null,
  onOpenWill,
  onOpen,
}: {
  chats: readonly Chat[];
  /** The coach's way in, right under Will's row (backend N521); null for
   *  everyone else. */
  coachRow?: ReactNode;
  /** The AI models' rows, under the people (backend N528 item 1): nothing
   *  below ring 6. */
  modelsRows?: ReactNode;
  /** Will's chat is open over the list (its row's line is then seen). */
  willOpen?: boolean;
  /** The row you just came back from, lit for a moment ("will" for Will's). */
  cameFrom?: string | null;
  /** The chat just joined through someone's link: the row right under
   *  Will's, marked new until it is opened (backend N357, N360). */
  joined?: string | null;
  onOpenWill: () => void;
  onOpen: (chat: Chat) => void;
}) {
  const now = new Date();
  const [adding, setAdding] = useState<boolean | "note">(false);
  const openAdd = useAddSomeone(setAdding);
  const first = joined ? chats.find((chat) => chat.id === joined) ?? null : null;
  const will = useWillRow(willOpen, cameFrom === WILL_CHAT);
  const row = (chat: Chat, justJoined = false) => (
    <ChatListRow
      key={chat.id}
      id={chat.id}
      circle={<PersonCircle id={chat.id} name={chat.title} size={48} assistant={chat.assistant} />}
      title={chat.title}
      subtitle={subtitleOf(chat)}
      time={listTime(chat.last?.created_at, now)}
      preview={
        chat.inquiry
          ? asksYouAbout(chat.inquiry.about)
          : chat.last
            ? lastLine(chat.last, chat.title)
            : chat.joined_through || justJoined
              ? joinedThanks(chat.joined_through || chat.title)
              : ""
      }
      isNew={chat.inquiry ? chat.inquiry.state === "new" : justJoined || chatIsNew(chat)}
      cameFrom={cameFrom === chat.id}
      onOpen={() => onOpen(chat)}
    />
  );
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div data-chat-list className="scrollbar-none flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <ChatListRow
        id={WILL_CHAT}
        circle={<WillMark />}
        title={WILL_ROW_TITLE}
        preview={will.preview}
        isNew={will.isNew}
        pinned
        cameFrom={cameFrom === WILL_CHAT}
        onOpen={onOpenWill}
      />
      {coachRow}
      {chats.filter((chat) => chat.inquiry).map((chat) => row(chat))}
      {first ? row(first, true) : null}
      {chats.filter((chat) => !chat.inquiry).length === 0 ? (
        /* Nobody else yet (the iPhone app shows the list with Will alone,
           founder 2026-11-02): adding someone is the next row, as the + does. */
        <ChatListRow
          id="add"
          circle={
            <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
              <Plus className="h-5 w-5 text-foreground" />
            </span>
          }
          title={ADD_SHEET_TITLE}
          onOpen={openAdd}
        />
      ) : null}
      {newestFirst(chats.filter((chat) => chat !== first && !chat.inquiry)).map((chat) => row(chat))}
      {modelsRows}
      </div>
      <button
        type="button"
        data-add-someone=""
        aria-label={ADD_SHEET_TITLE}
        onClick={openAdd}
        className="absolute bottom-5 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg"
      >
        <Plus className="h-5 w-5" aria-hidden />
      </button>
      {adding === "note" ? (
        <SetupNote onClose={() => setAdding(false)} onOpenWill={onOpenWill} onLink={() => setAdding(true)} />
      ) : adding ? (
        <AddSomeoneSheet onClose={() => setAdding(false)} />
      ) : null}
    </div>
  );
}
