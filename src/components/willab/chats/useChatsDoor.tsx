"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
/** Where Forward goes from the list: the chat you last came back from. */
type Ahead = { at: "will" } | { at: "chat"; chat: Chat };

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

/** The slide between the list and a chat (backend N378 item 4): iOS's own
 *  timing. None when the phone asks for less motion. */
const SLIDE_MS = 300;
const SLIDE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
/** How long the row you came back from stays lit (N378 item 5). */
const CAME_FROM_MS = 900;

function moves(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Out of reach while a chat covers it: no focus, no taps, hidden from a
 *  screen reader. React 18 has no `inert` prop of its own. */
const away = (yes: boolean) => (yes ? ({ inert: "", "aria-hidden": true } as Record<string, unknown>) : {});

/** A person's chat over the list: in from the right, out to the right on
 *  Back, following the finger while the edge swipe drags it out (`drag`), or
 *  pulls it in again from the list's right edge (`pull`, backend N436). */
function ChatSlide({
  leaving,
  drag,
  pull,
  children,
}: {
  leaving: boolean;
  drag: number | null;
  pull: number | null;
  children: ReactNode;
}) {
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
  const x =
    drag !== null ? `${drag}px` : pull !== null ? `calc(100% - ${pull}px)` : leaving || !entered ? "100%" : "0px";
  return (
    <div
      data-chat-slide=""
      className="absolute inset-0 flex flex-col bg-background shadow-[-8px_0_24px_rgba(0,0,0,0.08)]"
      style={{
        // No transform at rest: it would hold the full-screen photo (fixed)
        // inside the chat instead of over the whole screen.
        transform: x === "0px" ? "none" : `translateX(${x})`,
        transition: drag !== null || pull !== null || !moves() ? "none" : `transform ${SLIDE_MS}ms ${SLIDE_EASE}`,
      }}
    >
      {children}
    </div>
  );
}

/** The ☰ menu's id while it is open (MENU_ID in src/components/AppMenu.tsx). */
const MENU_OPEN = "#app-header-menu";

/** A screen opened over the list (the +'s sheet, the ☰ menu, any screen
 *  that Back closes): Forward leaves it alone (backend N436 item 2). */
function listCovered(): boolean {
  return backDismissDepth() > 0 || !!document.querySelector(`[data-add-sheet], ${MENU_OPEN}`);
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
  // The list opens even with Will's chat alone, with the way to add someone
  // under him: in the iPhone app (founder 2026-11-02) and on the web, where
  // a newcomer gets no demo chats (backend N401).
  const waiting = decided === null || (on && !chats);
  const closed = !on || !chats;
  // Open, the list is the bottom of /chat: Back never goes past it (N378).
  useBackStop(!closed);
  // A chat going out to the right after Back, still drawn while it slides.
  const [leaving, setLeaving] = useState<Chat | null>(null);
  // The row you came back from, lit for a moment (N378 item 5).
  const [cameFrom, setCameFrom] = useState<string | null>(null);
  // How far the edge swipe has dragged the chat, while it does.
  const [drag, setDrag] = useState<number | null>(null);
  // Forward (backend N436): the chat you last came back from, and how far the
  // swipe from the list's right edge has pulled it in, while it does.
  const [ahead, setAhead] = useState<Ahead | null>(null);
  const [pull, setPull] = useState<number | null>(null);
  const aheadRef = useRef(ahead);
  aheadRef.current = ahead;
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
    if (view.at !== "list") setAhead(view.at === "chat" ? { at: "chat", chat: view.chat } : { at: "will" });
    setView({ at: "list" });
    reload();
  };
  // The chat ahead, as the list now has it.
  const aheadNow: Ahead | null =
    ahead?.at === "chat" ? { at: "chat", chat: chats?.find((c) => c.id === ahead.chat.id) ?? ahead.chat } : ahead;
  const forward = () => {
    if (!aheadNow) return;
    setPull(null);
    setCameFrom(null);
    setView(aheadNow.at === "chat" ? { at: "chat", chat: aheadNow.chat } : { at: "will" });
  };
  const forwardRef = useRef(forward);
  forwardRef.current = forward;
  // The iPhone app's swipe from the left edge (N378 item 3): only from a chat
  // that is the top screen, never from the list or over an overlay.
  useEdgeSwipe(
    !closed && view.at !== "list" && isNativeApp(),
    (dx) => {
      if (backDismissDepth() === 1) setDrag(dx);
    },
    (back) => (back && backDismissDepth() === 1 ? toList() : setDrag(null)),
  );
  // And from the list's right edge, forward again to the chat you just left
  // (N436 item 1): never over a screen opened on the list. Let go early, a
  // person's chat slides back out to the right.
  useEdgeSwipe(
    !closed && view.at === "list" && !!ahead && isNativeApp(),
    (dx) => {
      if (!listCovered()) setPull(dx);
    },
    (go) => {
      if (listCovered()) return setPull(null);
      if (go) return forward();
      if (aheadNow?.at === "chat") setLeaving(aheadNow.chat);
      setPull(null);
    },
    "right",
  );
  // On the web, the browser's Forward (Safari's swipe from the right edge)
  // does the same (N436 item 3). It lands on the left chat's old history
  // entry: one Back to the list's own, then the chat opens with a fresh
  // entry, so no dead entry is left for a Back press to fall into.
  const atList = !closed && view.at === "list";
  useEffect(() => {
    if (!atList) return;
    let reopening = false;
    const onPop = () => {
      const state = window.history.state as Record<string, unknown> | null;
      const above = state?.__willabOverlay === true;
      if (reopening) {
        if (!above) {
          reopening = false;
          forwardRef.current();
        }
        return;
      }
      if (above && !listCovered() && aheadRef.current) {
        reopening = true;
        window.history.back();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [atList]);
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
        pull={view.at === "list" ? pull : null}
        ahead={aheadNow}
        shown={view.at === "chat" ? view.chat : leaving}
        chatOpen={view.at === "chat"}
        list={
          <ChatList
            chats={chats}
            joined={joined}
            cameFrom={cameFrom}
            willOpen={atWill}
            onOpenWill={() => setView({ at: "will" })}
            onOpen={(chat) => {
              if (chat.id === joined) setJoined(null);
              setCameFrom(null);
              setView({ at: "chat", chat });
            }}
          />
        }
        thread={(chat, open) => (
          <ChatThread chat={chat} open={open} onBack={toList} onRecordAnswer={onRecordAnswer} />
        )}
      />
    ),
  };
}

/** The list, and a person's chat over it. Will's chat is the Lounge
 *  underneath: the list slides away to the left to open it and comes back
 *  from the left on Back, after the finger as it drags (N378 item 4); the
 *  swipe from the list's right edge pulls the chat you just left in again
 *  the same way (N436). */
function ChatsFront({
  atWill,
  drag,
  pull,
  ahead,
  shown,
  chatOpen,
  list,
  thread,
}: {
  atWill: boolean;
  drag: number | null;
  /** How far the swipe from the list's right edge has pulled `ahead` in. */
  pull: number | null;
  ahead: Ahead | null;
  /** The chat drawn over the list: the open one, or one sliding out. */
  shown: Chat | null;
  chatOpen: boolean;
  list: ReactNode;
  /** `open`: the chat is the screen, not one pulled in or sliding out. */
  thread: (chat: Chat, open: boolean) => ReactNode;
}) {
  const pulling = pull !== null ? ahead : null;
  const parked = atWill && drag === null;
  const listX = atWill
    ? drag !== null
      ? `calc(-100% + ${drag}px)`
      : "-100%"
    : pulling?.at === "will"
      ? `-${pull}px`
      : "0px";
  const moving = drag !== null || pulling !== null;
  // A person's chat pulled in from the right edge draws in the same place as
  // the one it becomes, so it is not drawn twice when you let go.
  const pulled = pulling?.at === "chat" && !shown ? pulling.chat : null;
  const slide = shown ?? pulled;
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
          !moving && moves()
            ? `transform ${SLIDE_MS}ms ${SLIDE_EASE}, visibility 0s linear ${atWill ? SLIDE_MS : 0}ms`
            : "none",
      }}
    >
      {/* The list stays drawn under a chat, so it keeps its place (item 5). */}
      <div className="absolute inset-0 flex flex-col bg-background" {...away(!!slide)}>
        <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col">{list}</div>
      </div>
      {slide ? (
        <ChatSlide
          key={slide.id}
          leaving={!chatOpen}
          drag={chatOpen ? drag : null}
          pull={!chatOpen && pulling?.at === "chat" && pulling.chat.id === slide.id ? pull : null}
        >
          <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col">{thread(slide, chatOpen)}</div>
        </ChatSlide>
      ) : null}
    </div>
  );
}
