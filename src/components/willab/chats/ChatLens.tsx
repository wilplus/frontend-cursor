"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import WalkStage from "../walk/WalkStage";
import { ConversationBubble } from "./TakeConversation";
import OverlayCloseButton from "../OverlayCloseButton";
import { TypingGlyph } from "../TypingDots";
import type { Item } from "../LoungeLifeGoals";

/* -------------------------------------------------------------------------- */
/*  A lens, in the chat (backend N691 item 5).                                */
/*                                                                            */
/*  Strengths, life goals, "your why" and the Sunday note were each a script  */
/*  in a screen of its own: Will says, the dock asks, the answer lands as the */
/*  speaker's bubble. In the chat the same script runs in the thread: Will's  */
/*  lines and the answers are bubbles at its end, and the dock takes the      */
/*  composer's place until the script ends. The conversation stays in the     */
/*  thread after it closes. Where there is no chat (the Life Panel's pages),  */
/*  the lens keeps its own frame.                                             */
/* -------------------------------------------------------------------------- */

/** The thread's end, where a lens's bubbles go (Lounge.tsx). */
export const CHAT_LENS_THREAD = "data-chat-lens-thread";
/** The slot that takes the composer's place while a lens asks (Lounge.tsx). */
export const CHAT_LENS_DOCK = "data-chat-lens-dock";

type Targets = { thread: Element; dock: Element | null };

function chatTargets(): Targets | null {
  const thread = document.querySelector(`[${CHAT_LENS_THREAD}]`);
  return thread ? { thread, dock: document.querySelector(`[${CHAT_LENS_DOCK}]`) } : null;
}

export default function ChatLens({
  open,
  stageKey,
  label,
  items,
  typing,
  dock,
  onClose,
  frame,
}: {
  open: boolean;
  /** The lens's own frame's key, where there is no chat. */
  stageKey: string;
  label: string;
  items: readonly Item[];
  typing: boolean;
  dock: ReactNode;
  onClose: () => void;
  /** The lens's own frame, drawn where there is no chat. */
  frame: (ghost: boolean) => ReactNode;
}) {
  // undefined: not looked yet; null: no chat on this page.
  const [targets, setTargets] = useState<Targets | null | undefined>(undefined);
  useEffect(() => {
    if (open) setTargets(chatTargets());
  }, [open]);
  const section = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    section.current?.lastElementChild?.scrollIntoView?.({ block: "end", behavior: "smooth" });
  }, [open, items.length, typing, dock]);

  if (targets === null) {
    return (
      <div data-feedback-walk>
        <WalkStage screen={{ key: stageKey, overlay: open }} render={(_screen, ghost) => frame(Boolean(ghost))} />
      </div>
    );
  }
  if (!targets || (!open && !items.length)) return null;
  return (
    <>
      {createPortal(
        <section ref={section} aria-label={label} data-chat-lens className="flex flex-col gap-2 py-1">
          {items.map((item) => (
            <ConversationBubble key={item.id} speaker={item.who === "me"} className="walk-bubble-in">
              {item.node}
            </ConversationBubble>
          ))}
          {open && typing ? (
            <ConversationBubble>
              <TypingGlyph />
            </ConversationBubble>
          ) : null}
        </section>,
        targets.thread,
      )}
      {open && targets.dock
        ? createPortal(
            <div data-walk-dock className="flex items-end gap-2">
              <div className="min-w-0 flex-1">{dock}</div>
              <OverlayCloseButton onClick={onClose} className="walk-press-sm mb-2 shrink-0" />
            </div>,
            targets.dock,
          )
        : null}
    </>
  );
}
