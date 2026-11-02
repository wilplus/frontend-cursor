"use client";

import type { Chat } from "@/services/api/chats";

/* -------------------------------------------------------------------------- */
/*  The list of chats (backend N256, N274, N298; rules:                        */
/*  docs/flows/customer-requests.md §1 C1): Will pinned on top, then each      */
/*  chat with its title, its subtitle and its last message. No pictures       */
/*  (N301).                                                                   */
/* -------------------------------------------------------------------------- */

/** Will's chat is the Lounge; its row carries only his name. */
export const WILL_ROW_TITLE = "Will";

function ChatListRow({
  id,
  title,
  subtitle = null,
  preview = null,
  onOpen,
}: {
  id: string;
  title: string;
  subtitle?: string | null;
  preview?: string | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      data-chat-row={id}
      onClick={onOpen}
      className="flex w-full shrink-0 flex-col items-start gap-0.5 border-b border-border py-3 text-left"
    >
      <span className="max-w-full truncate text-[16px] font-semibold leading-snug text-foreground">{title}</span>
      {subtitle ? <span className="max-w-full truncate text-[12px] leading-snug text-muted-foreground">{subtitle}</span> : null}
      {preview ? <span className="max-w-full truncate text-[14px] leading-snug text-muted-foreground">{preview}</span> : null}
    </button>
  );
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
  return (
    <div data-chat-list className="scrollbar-none flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <ChatListRow id="will" title={WILL_ROW_TITLE} onOpen={onOpenWill} />
      {chats.map((chat) => (
        <ChatListRow
          key={chat.id}
          id={chat.id}
          title={chat.title}
          subtitle={chat.subtitle}
          preview={chat.last?.body ?? null}
          onOpen={() => onOpen(chat)}
        />
      ))}
    </div>
  );
}
