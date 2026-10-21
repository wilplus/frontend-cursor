"use client";

import { useEffect } from "react";

/* -------------------------------------------------------------------------- */
/*  THE COACH'S BUBBLE, SHOWN (founder 2026-10-21, WIL-93: "at least just open */
/*  the lounge and the bubble with orange dot will be there"; "ok do it")      */
/*                                                                            */
/*  When the coach's door finds nothing of the coach's on the page (a link    */
/*  naming an earlier Take whose coach left only moment answers), it closes   */
/*  to the chat, and the chat scrolls to the coach's bubble for that Take, or */
/*  the newest one, which pulses once. No words. A reader who asked for less  */
/*  motion gets the scroll alone.                                              */
/* -------------------------------------------------------------------------- */

const EVENT = "willab:show-coach-bubble";
/** On a coach's word bubble in the chat: the Take its word is of. */
export const COACH_BUBBLE_ATTR = "data-coach-take";
/** After the page has closed and the chat has settled its own scroll. */
const SETTLE_MS = 350;

/** Ask the chat to show the coach's bubble (null: the newest one). */
export function showCoachBubble(take: string | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { take } }));
}

/** The bubble to show: that Take's newest, else the newest of any Take. */
export function coachBubbleFor(root: ParentNode, take: string | null): HTMLElement | null {
  const all = [...root.querySelectorAll<HTMLElement>(`[${COACH_BUBBLE_ATTR}]`)];
  const own = take ? all.filter((el) => el.getAttribute(COACH_BUBBLE_ATTR) === take) : [];
  return own.at(-1) ?? all.at(-1) ?? null;
}

function focusBubble(el: HTMLElement | null): void {
  if (!el) return;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  el.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  if (still || typeof el.animate !== "function") return;
  el.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.05)" }, { transform: "scale(1)" }],
    { duration: 700, delay: 300, easing: "ease-in-out" },
  );
}

/** The chat's side: shows the bubble when asked. */
export function useCoachBubbleFocus(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onShow = (event: Event) => {
      const take = (event as CustomEvent<{ take?: string | null }>).detail?.take ?? null;
      clearTimeout(timer);
      timer = setTimeout(() => focusBubble(coachBubbleFor(document, take)), SETTLE_MS);
    };
    window.addEventListener(EVENT, onShow);
    return () => {
      window.removeEventListener(EVENT, onShow);
      clearTimeout(timer);
    };
  }, []);
}
