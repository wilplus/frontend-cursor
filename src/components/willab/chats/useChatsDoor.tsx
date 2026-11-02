"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Chat } from "@/services/api/chats";
import ChatList from "./ChatList";
import ChatThread, { WillTopBar } from "./ChatThread";
import { useChatList, useChatsDecided } from "./useChats";
import LoadingState from "../LoadingState";
import { isNativeApp } from "@/lib/auth/nativeSignIn";

/* -------------------------------------------------------------------------- */
/*  The chats in front of the Lounge (ring 6, feature `chats`; backend N274,   */
/*  N298, N321, N322, N334; rules: docs/flows/customer-requests.md §1 C1).    */
/*  The Lounge stays mounted and unchanged underneath: the list, or a chat,   */
/*  covers it; Will's row uncovers it, with his own top bar above it. In      */
/*  every chat, Will's included, the WillpowerLab bar goes and the chat's own */
/*  top bar takes its place; it shows on the list only (N321 item 1, N334     */
/*  item 1; was N322 item 4). On a computer, the list and a person's chat sit */
/*  in a phone-wide column in the middle. Off, or with no chat but Will's,    */
/*  nothing is drawn and /chat is the Lounge as it is (Never 3); in the       */
/*  iPhone app, on, the list opens even with Will's chat alone; there, until  */
/*  the rings and the list have answered, the loader covers the Lounge, so it */
/*  never shows for a moment before the list draws over it. On the web the    */
/*  Lounge paints at once, as most accounts have no chats.                    */
/* -------------------------------------------------------------------------- */

type View = { at: "list" } | { at: "will" } | { at: "chat"; chat: Chat };

export type ChatsDoor = {
  /** Above the Lounge while it is open as Will's chat: his top bar, back to the list. */
  back: ReactNode;
  /** In front of the Lounge: the list, or a chat. Needs a `relative` parent. */
  front: ReactNode;
  /** Whether the WillpowerLab bar shows: on the list only, not in a chat (N334). */
  navbar: boolean;
};

const CLOSED: ChatsDoor = { back: null, front: null, navbar: true };

/** The iPhone app, while the door is not yet known: the loader over the Lounge. */
const WAITING: ChatsDoor = {
  back: null,
  navbar: true,
  front: (
    <div data-chats-front data-chats-waiting className="absolute inset-0 z-20 flex flex-col bg-background">
      <LoadingState placement="surface" />
    </div>
  ),
};

/** The chat just joined through someone's link, from `/chat?with=<id>`: the
 *  list opens with it as the first row, marked new (backend N357; was N348
 *  item 1: that chat opened). */
function chatJustJoined(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("with");
}

/** `willFirst`: a link that opens something in the Lounge (the coach's
 *  feedback) opens on Will's chat, not the list. */
export function useChatsDoor(willFirst: boolean): ChatsDoor {
  const decided = useChatsDecided();
  const on = decided === true;
  const { chats, reload } = useChatList(on);
  const [view, setView] = useState<View>(() => ({ at: willFirst ? "will" : "list" }));
  const [joined, setJoined] = useState<string | null>(chatJustJoined);
  // Just joined: the address is clean again; the list keeps that chat on top
  // until it is opened.
  useEffect(() => {
    if (joined && window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, [joined]);
  // In the iPhone app the list opens even with Will's chat alone, with the
  // way to add someone under him (founder 2026-11-02); on the web, as before.
  const waiting = decided === null || (on && !chats);
  // A link into the Lounge opens on Will's chat: nothing would cover it.
  if (waiting && isNativeApp() && view.at !== "will") return WAITING;
  if (!on || !chats || (chats.length === 0 && !isNativeApp())) return CLOSED;
  const toList = () => {
    setView({ at: "list" });
    reload();
  };
  if (view.at === "will") {
    return { back: <WillTopBar onBack={toList} />, front: null, navbar: false };
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
            <ChatList
              chats={chats}
              joined={joined}
              onOpenWill={() => setView({ at: "will" })}
              onOpen={(chat) => {
                if (chat.id === joined) setJoined(null);
                setView({ at: "chat", chat });
              }}
            />
          )}
        </div>
      </div>
    ),
  };
}
