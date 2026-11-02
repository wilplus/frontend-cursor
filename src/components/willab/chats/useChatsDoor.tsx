"use client";

import { useState, type ReactNode } from "react";
import type { Chat } from "@/services/api/chats";
import ChatList, { WILL_ROW_TITLE } from "./ChatList";
import ChatThread, { ChatHeader } from "./ChatThread";
import { useChatList, useChatsOn } from "./useChats";

/* -------------------------------------------------------------------------- */
/*  The chats in front of the Lounge (ring 6, feature `chats`; backend N274,   */
/*  N298, N321, N322; rules: docs/flows/customer-requests.md §1 C1). The      */
/*  Lounge stays mounted and unchanged underneath: the list, or a chat,       */
/*  covers it; Will's row uncovers it, with a back to the list above it. In a */
/*  person's chat the WillpowerLab bar goes and the chat's own top bar takes  */
/*  its place (N321 item 1); on the list and in Will's chat it stays (N322    */
/*  item 4). On a computer, the list and a chat sit in a phone-wide column in */
/*  the middle. Off, or with no chat but Will's, nothing is drawn and /chat   */
/*  is the Lounge as it is (Never 3).                                         */
/* -------------------------------------------------------------------------- */

type View = { at: "list" } | { at: "will" } | { at: "chat"; chat: Chat };

export type ChatsDoor = {
  /** Above the Lounge while it is open as Will's chat: back to the list. */
  back: ReactNode;
  /** In front of the Lounge: the list, or a chat. Needs a `relative` parent. */
  front: ReactNode;
  /** Whether the WillpowerLab bar shows: not while a person's chat is open. */
  navbar: boolean;
};

const CLOSED: ChatsDoor = { back: null, front: null, navbar: true };

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
    return { back: <ChatHeader title={WILL_ROW_TITLE} onBack={toList} />, front: null, navbar: true };
  }
  return {
    back: null,
    navbar: view.at !== "chat",
    front: (
      <div data-chats-front className="absolute inset-0 z-20 flex flex-col bg-background">
        <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col">
          {view.at === "chat" ? (
            <ChatThread key={view.chat.id} chat={view.chat} onBack={toList} />
          ) : (
            <ChatList chats={chats} onOpenWill={() => setView({ at: "will" })} onOpen={(chat) => setView({ at: "chat", chat })} />
          )}
        </div>
      </div>
    ),
  };
}
