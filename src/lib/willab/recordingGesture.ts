/* -------------------------------------------------------------------------- */
/*  recordingGesture — how the recording screen moves (founder lock            */
/*  2026-10-12, FOUNDER-LOCK-recording-screens-2026-10-07 as amended, N70).     */
/*                                                                            */
/*  Buttons, not scrolling: Back and Next slide change the slide; a swipe or  */
/*  a scroll never does. The slide moves sideways, out in 200ms and in from   */
/*  the other side in 420ms on cubic-bezier(.16,1,.3,1); instant with reduce  */
/*  motion.                                                                   */
/*                                                                            */
/*  keys    ← → change the slide; ↓ Page Down Space forward, ↑ Page Up back,  */
/*          after scrolling long helper words. Keys never end a Take, and a   */
/*          focused button keeps its own Space and Enter (N70.1).             */
/* -------------------------------------------------------------------------- */

export const GLIDE_OUT_MS = 200;
export const LAND_MS = 420;
export const LAND_EASE = "cubic-bezier(.16,1,.3,1)";
/** The recording screen's entrance from "Getting your mic ready". */
export const ENTER_OFFSET_PX = 24;

export type Dir = 1 | -1;

/** What a key asks of the recording screen. "slide" keys always change the
 *  slide; "scroll" keys scroll long helper words first. */
export type KeyIntent = { dir: Dir; slide: boolean } | null;

export function keyIntent(key: string): KeyIntent {
  switch (key) {
    case "ArrowRight":
      return { dir: 1, slide: true };
    case "ArrowLeft":
      return { dir: -1, slide: true };
    case "ArrowDown":
    case "PageDown":
    case " ":
    case "Spacebar":
      return { dir: 1, slide: false };
    case "ArrowUp":
    case "PageUp":
      return { dir: -1, slide: false };
    default:
      return null;
  }
}

const TYPING =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/** May the recording screen take this key? Never from a field the speaker
 *  is typing in, never a shortcut, never under an open dialog, and never the
 *  Space that presses a focused button. */
export function keyIsForTheScreen(
  event: {
    key: string;
    defaultPrevented: boolean;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    target: EventTarget | null;
  },
  doc: Document,
  root: Element | null,
): boolean {
  if (event.defaultPrevented) return false;
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  const target = event.target;
  if (target instanceof Element) {
    if (target.closest(TYPING)) return false;
    const presses = event.key === " " || event.key === "Spacebar" || event.key === "Enter";
    if (presses && target.closest('button, a, [role="button"]')) return false;
  }
  return !modalOpenOver(doc, root);
}

/** A modal dialog is open that does not contain the screen. */
export function modalOpenOver(doc: Document, root: Element | null): boolean {
  const modals = doc.querySelectorAll('[aria-modal="true"]');
  for (const modal of Array.from(modals)) {
    if (!root || !modal.contains(root)) return true;
  }
  return false;
}
