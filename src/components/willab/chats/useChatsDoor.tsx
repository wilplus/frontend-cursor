"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Chat } from "@/services/api/chats";
import type { AnswerFor } from "@/lib/willab/chatAnswer";
import ChatList from "./ChatList";
import ChatThread, { WillTopBar } from "./ChatThread";
import { useChatList, useChatsDecided } from "./useChats";
import LoadingState from "../LoadingState";
import { isNativeApp } from "@/lib/auth/nativeSignIn";
import { backDismissDepth, useBackStop } from "../useBackDismiss";
import { useEdgeSwipe } from "./useEdgeSwipe";

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

/** The slide between the list and a chat (backend N372 item 4): iOS's own
 *  timing. None when the phone asks for less motion. */
const SLIDE_MS = 300;
const SLIDE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
/** How long the row you came back from stays lit (N372 item 5). */
const CAME_FROM_MS = 900;

function moves(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Out of reach while a chat covers it: no focus, no taps, hidden from a
 *  screen reader. React 18 has no `inert` prop of its own. */
const away = (yes: boolean) => (yes ? ({ inert: "", "aria-hidden": true } as Record<string, unknown>) : {});

/** A person's chat over the list: in from the right, out to the right on
 *  Back, following the finger while the edge swipe drags it. */
function ChatSlide({ leaving, drag, children }: { leaving: boolean; drag: number | null; children: ReactNode }) {
  const [entered, setEntered] = useState(() => !moves());
  useEffect(() => {
    if (entered) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [entered]);
  const x = drag !== null ? `${drag}px` : leaving || !entered ? "100%" : "0px";
  return (
    <div
      data-chat-slide=""
      className="absolute inset-0 flex flex-col bg-background shadow-[-8px_0_24px_rgba(0,0,0,0.08)]"
      style={{
        // No transform at rest: it would hold the full-screen photo (fixed)
        // inside the chat instead of over the whole screen.
        transform: x === "0px" ? "none" : `translateX(${x})`,
        transition: drag !== null || !moves() ? "none" : `transform ${SLIDE_MS}ms ${SLIDE_EASE}`,
      }}
    >
      {children}
    </div>
  );
}

/** `willFirst`: a link that opens something in the Lounge (the coach's
 *  feedback) opens on Will's chat, not the list. `onRecordAnswer`: a chat's
 *  "Record an answer" (backend N363), handed to the recording screens. */
export function useChatsDoor(willFirst: boolean, onRecordAnswer?: (answer: AnswerFor) => void): ChatsDoor {
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
  const closed = !on || !chats || (chats.length === 0 && !isNativeApp());
  // Open, the list is the bottom of /chat: Back never goes past it (N372).
  useBackStop(!closed);
  // A chat going out to the right after Back, still drawn while it slides.
  const [leaving, setLeaving] = useState<Chat | null>(null);
  // The row you came back from, lit for a moment (N372 item 5).
  const [cameFrom, setCameFrom] = useState<string | null>(null);
  // How far the edge swipe has dragged the chat, while it does.
  const [drag, setDrag] = useState<number | null>(null);
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setLeaving(null), moves() ? SLIDE_MS : 0);
    return () => window.clearTimeout(t);
  }, [leaving]);
  useEffect(() => {
    if (!cameFrom) return;
    const t = window.setTimeout(() => setCameFrom(null), CAME_FROM_MS);
    return () => window.clearTimeout(t);
  }, [cameFrom]);
  const toList = () => {
    setDrag(null);
    if (view.at === "chat") setLeaving(view.chat);
    if (view.at !== "list") setCameFrom(view.at === "chat" ? view.chat.id : "will");
    setView({ at: "list" });
    reload();
  };
  // The iPhone app's swipe from the left edge (N372 item 3): only from a chat
  // that is the top screen, never from the list or over an overlay.
  useEdgeSwipe(
    !closed && view.at !== "list" && isNativeApp(),
    (dx) => {
      if (backDismissDepth() === 1) setDrag(dx);
    },
    (back) => (back && backDismissDepth() === 1 ? toList() : setDrag(null)),
  );
  // A link into the Lounge opens on Will's chat: nothing would cover it.
  if (waiting && isNativeApp() && view.at !== "will") return WAITING;
  if (closed || !chats) return CLOSED;
  const atWill = view.at === "will";
  return {
    back: atWill ? <WillTopBar onBack={toList} /> : null,
    navbar: view.at === "list",
    front: (
      <ChatsFront
        atWill={atWill}
        drag={drag}
        shown={view.at === "chat" ? view.chat : leaving}
        chatOpen={view.at === "chat"}
        list={
          <ChatList
            chats={chats}
            joined={joined}
            cameFrom={cameFrom}
            onOpenWill={() => setView({ at: "will" })}
            onOpen={(chat) => {
              if (chat.id === joined) setJoined(null);
              setCameFrom(null);
              setView({ at: "chat", chat });
            }}
          />
        }
        thread={(chat) => <ChatThread chat={chat} onBack={toList} onRecordAnswer={onRecordAnswer} />}
      />
    ),
  };
}

/** The list, and a person's chat over it. Will's chat is the Lounge
 *  underneath: the list slides away to the left to open it and comes back
 *  from the left on Back, after the finger as it drags (N372 item 4). */
function ChatsFront({
  atWill,
  drag,
  shown,
  chatOpen,
  list,
  thread,
}: {
  atWill: boolean;
  drag: number | null;
  /** The chat drawn over the list: the open one, or one sliding out. */
  shown: Chat | null;
  chatOpen: boolean;
  list: ReactNode;
  thread: (chat: Chat) => ReactNode;
}) {
  const parked = atWill && drag === null;
  const listX = atWill ? (drag !== null ? `calc(-100% + ${drag}px)` : "-100%") : "0px";
  return (
    <div
      data-chats-front
      data-chats-away={parked ? "" : undefined}
      {...away(atWill)}
      className="absolute inset-0 z-20 overflow-hidden"
      style={{
        transform: listX === "0px" ? "none" : `translateX(${listX})`,
        visibility: parked ? "hidden" : "visible",
        transition:
          drag === null && moves()
            ? `transform ${SLIDE_MS}ms ${SLIDE_EASE}, visibility 0s linear ${atWill ? SLIDE_MS : 0}ms`
            : "none",
      }}
    >
      {/* The list stays drawn under a chat, so it keeps its place (item 5). */}
      <div className="absolute inset-0 flex flex-col bg-background" {...away(!!shown)}>
        <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col">{list}</div>
      </div>
      {shown ? (
        <ChatSlide key={shown.id} leaving={!chatOpen} drag={chatOpen ? drag : null}>
          <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col">{thread(shown)}</div>
        </ChatSlide>
      ) : null}
    </div>
  );
}
