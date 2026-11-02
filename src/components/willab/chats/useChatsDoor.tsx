"use client";

import { useState, type ReactNode } from "react";
import type { Chat } from "@/services/api/chats";
import ChatList, { WILL_ROW_TITLE } from "./ChatList";
import ChatThread, { ChatHeader } from "./ChatThread";
import { useChatList, useChatsOn } from "./useChats";

/* -------------------------------------------------------------------------- */
/*  The chats in front of the Lounge (ring 6, feature `chats`; backend N274,   */
/*  N298; rules: docs/flows/customer-requests.md §1 C1). The Lounge stays     */
/*  mounted and unchanged underneath: the list, or a chat, covers it; Will's  */
/*  row uncovers it, with a back to the list above it. Off, or with no chat   */
/*  but Will's, nothing is drawn and /chat is the Lounge as it is (Never 3).  */
/* -------------------------------------------------------------------------- */

type View = { at: "list" } | { at: "will" } | { at: "chat"; chat: Chat };

export type ChatsDoor = {
  /** Above the Lounge while it is open as Will's chat: back to the list. */
  back: ReactNode;
  /** In front of the Lounge: the list, or a chat. Needs a `relative` parent. */
  front: ReactNode;
};

const CLOSED: ChatsDoor = { back: null, front: null };

/** `willFirst`: a link that opens something in the Lounge (the coach's
 *  feedback) opens on Will's chat, not the list. */
export function useChatsDoor(willFirst: boolean): ChatsDoor {
  const on = useChatsOn();
  const { chats, reload } = useChatList(on);
  const [view, setView] = useState<View>(() => ({ at: willFirst ? "will" : "list" }));
  if (!on || !chats || chats.length === 0) return CLOSED;
  const toList = () => {
    setView({ at: "list" });
    reload();
  };
  if (view.at === "will") {
    return { back: <ChatHeader title={WILL_ROW_TITLE} onBack={toList} />, front: null };
  }
  return {
    back: null,
    front: (
      <div data-chats-front className="absolute inset-0 z-20 flex flex-col bg-background px-4 pb-2">
        {view.at === "chat" ? (
          <ChatThread key={view.chat.id} chat={view.chat} onBack={toList} />
        ) : (
          <ChatList chats={chats} onOpenWill={() => setView({ at: "will" })} onOpen={(chat) => setView({ at: "chat", chat })} />
        )}
      </div>
    ),
  };
}
