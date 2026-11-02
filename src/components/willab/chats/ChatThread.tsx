"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { CHUNK_SHEET_COPY } from "@/components/willab/idealEditCopy";
import TypingDots from "@/components/willab/TypingDots";
import { useBackDismiss } from "@/components/willab/useBackDismiss";
import {
  CHAT_EMOJI,
  getChatMessages,
  sendChatEmoji,
  type Chat,
  type ChatEmoji,
  type ChatMessage,
} from "@/services/api/chats";

/* -------------------------------------------------------------------------- */
/*  A chat with someone (backend N298, N302, N306, N311; rules:               */
/*  docs/flows/customer-requests.md §1 C1). Built on the Lounge's own chat    */
/*  design (N301): its grey and orange bubbles, no picture beside them, and   */
/*  the locked bar's shape with the three emoji in the box where Will's chat  */
/*  has "Type here" (N306). Only the conversation shows here; no asks (N305). */
/* -------------------------------------------------------------------------- */

/** One meaning per emoji, everywhere; a sent emoji shows it under itself
 *  (N311 item 1, signed). */
export const EMOJI_MEANING: Record<ChatEmoji, string> = {
  "👍": "It's good",
  "👀": "Seen, I'll answer",
  "🙏": "Thanks",
};

function meaningOf(body: string): string | null {
  return (EMOJI_MEANING as Record<string, string>)[body] ?? null;
}

/** The top of a chat: back, then who it is with. */
export function ChatHeader({ title, subtitle = null, onBack }: { title: string; subtitle?: string | null; onBack: () => void }) {
  return (
    <div data-chat-header className="-ml-2.5 flex min-h-[44px] shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={onBack}
        aria-label={CHUNK_SHEET_COPY.pagerBack}
        className="walk-press-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[16px] font-semibold leading-tight text-foreground">{title}</span>
        {subtitle ? <span className="truncate text-[12px] leading-tight text-muted-foreground">{subtitle}</span> : null}
      </span>
    </div>
  );
}

/** One message, as the Lounge draws it: theirs grey on the left, mine orange
 *  on the right; an emoji large, with its meaning under it. */
function ChatRow({ message }: { message: ChatMessage }) {
  const meaning = message.kind === "emoji" ? meaningOf(message.body) : null;
  if (message.kind === "emoji") {
    return (
      <div data-chat-emoji className={`flex flex-col ${message.mine ? "ml-auto items-end" : "mr-auto items-start"}`}>
        <span className="text-[56px] leading-[1.1]">{message.body}</span>
        {meaning ? <span className="text-[12px] font-medium leading-[1.3] text-muted-foreground">{meaning}</span> : null}
      </div>
    );
  }
  if (message.mine) {
    return (
      <div data-row="me" data-bubble="" className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-primary px-3 py-2 text-[15px] text-primary-foreground">
        {message.body}
      </div>
    );
  }
  return (
    <div data-row="app" className="mr-auto flex max-w-[88%]">
      <div data-bubble="" className="whitespace-pre-wrap break-words rounded-[16px] bg-muted px-3 py-2 text-[15px] leading-[1.45] text-foreground">
        {message.body}
      </div>
    </div>
  );
}

/** The locked bar's shape (the Lounge's composer): the rounded box, with the
 *  three emoji as 40px round buttons in it. No typing outside Will's chat. */
function EmojiBar({ onPick }: { onPick: (emoji: ChatEmoji) => void }) {
  return (
    <div data-chat-bar className="flex shrink-0 items-end gap-1">
      <div className="flex min-h-[40px] flex-1 items-center justify-around rounded-3xl border border-border bg-background px-2">
        {CHAT_EMOJI.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={EMOJI_MEANING[emoji]}
            onClick={() => onPick(emoji)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[21px] leading-none transition-colors hover:bg-muted"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

let localSeq = 0;

export default function ChatThread({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useBackDismiss(onBack);

  useEffect(() => {
    let cancelled = false;
    void getChatMessages(chat.id).then((list) => {
      if (!cancelled) setMessages(list ?? []);
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
    <div data-chat-screen className="flex min-h-0 flex-1 flex-col gap-3">
      <ChatHeader title={chat.title} subtitle={chat.subtitle} onBack={onBack} />
      <div
        ref={scrollRef}
        data-chat-thread
        className="scrollbar-none flex flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden overscroll-contain pb-2"
      >
        {messages === null ? (
          <TypingDots label="Loading" />
        ) : (
          messages.map((message) => <ChatRow key={message.id} message={message} />)
        )}
      </div>
      <EmojiBar onPick={(emoji) => void send(emoji)} />
    </div>
  );
}
