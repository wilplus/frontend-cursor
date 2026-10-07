/* -------------------------------------------------------------------------- */
/*  recordingGesture — how the recording screens move (founder lock            */
/*  2026-10-07, FOUNDER-LOCK-recording-screens-2026-10-07, "How it moves").    */
/*                                                                            */
/*  Pure numbers and reducers, so the thresholds the founder locked are       */
/*  tested here rather than inferred from a browser:                          */
/*                                                                            */
/*    touch   a slide moves after 90px of finger travel; less springs back    */
/*    wheel   140 of accumulated scroll moves at once, or 90 if the wheel     */
/*            then rests 220ms; after a move the momentum tail is ignored     */
/*            for 450ms, so one flick is one slide                            */
/*    landing out in the direction of travel in 200ms, in from the other      */
/*            side in 420ms on cubic-bezier(.16,1,.3,1); instant with reduce  */
/*            motion                                                          */
/*    keys    ↓, Page Down, Space forward; ↑, Page Up back; Enter starts      */
/*                                                                            */
/*  "Deliberately less sensitive than before" (the lock): the old roadmap     */
/*  moved at 48px of touch and at any wheel tick past 18.                     */
/* -------------------------------------------------------------------------- */

export const TOUCH_COMMIT_PX = 90;
export const WHEEL_COMMIT = 140;
export const WHEEL_SOFT = 90;
export const WHEEL_REST_MS = 220;
export const MOMENTUM_MS = 450;
export const GLIDE_OUT_MS = 200;
export const LAND_MS = 420;
export const LAND_EASE = "cubic-bezier(.16,1,.3,1)";
/** How far the content follows a wheel push, as a share of the push. */
export const WHEEL_FOLLOW = 0.6;
/** A later Take's recording screen glides in from this far below. */
export const ENTER_OFFSET_PX = 24;

export type Dir = 1 | -1;

/** The rubber band: how far the content follows a finger (or a wheel) that
 *  has travelled `d` px. Free (a move is possible that way) it follows at
 *  0.42, against a wall at 0.16; past 140px it stiffens to a fifth. Signed
 *  like `d`. */
export function rubberBand(d: number, free: boolean): number {
  const k = free ? 0.42 : 0.16;
  let v = Math.abs(d) * k;
  if (v > 140) v = 140 + (v - 140) * 0.2;
  return d < 0 ? -v : v;
}

/** The content's fade while it follows: never below 0.65. */
export function followOpacity(offsetPx: number): number {
  return 1 - Math.min(Math.abs(offsetPx) / 420, 0.35);
}

/** A released touch: the direction to move in, or 0 to spring back.
 *  `travel` is the finger's upward travel in px (start y − end y), so a
 *  swipe up (a scroll down) is positive and goes forward. */
export function touchRelease(travel: number, canGo: (dir: Dir) => boolean): Dir | 0 {
  if (Math.abs(travel) < TOUCH_COMMIT_PX) return 0;
  const dir: Dir = travel > 0 ? 1 : -1;
  return canGo(dir) ? dir : 0;
}

export interface WheelState {
  /** Scroll accumulated at the slide's edge in this push. */
  acc: number;
  /** When the last wheel event arrived, or null before the first. */
  last: number | null;
  /** A move happened: swallow the momentum tail. */
  locked: boolean;
}

export const IDLE_WHEEL: WheelState = { acc: 0, last: null, locked: false };

export type WheelAction =
  /** Momentum after a move, or a push while a move is landing. */
  | { kind: "ignore" }
  /** The helper words take the scroll. */
  | { kind: "scroll-inner" }
  /** Not yet a move: the content follows `acc`; arm the rest timer. */
  | { kind: "follow"; acc: number; dir: Dir }
  /** A move in `dir`. */
  | { kind: "commit"; dir: Dir };

/** One wheel event. `deltaY` in px; `innerCanTake` = the helper words can
 *  still scroll that way; `busy` = a move is still landing. */
export function wheelStep(
  state: WheelState,
  input: { deltaY: number; now: number; innerCanTake: boolean; busy: boolean },
): { state: WheelState; action: WheelAction } {
  const { deltaY, now } = input;
  let current = state;
  if (current.locked) {
    if (current.last !== null && now - current.last < MOMENTUM_MS) {
      return { state: { ...current, last: now }, action: { kind: "ignore" } };
    }
    current = { ...current, locked: false };
  }
  current = { ...current, last: now };
  if (input.innerCanTake && current.acc === 0) {
    return { state: current, action: { kind: "scroll-inner" } };
  }
  if (input.busy) return { state: current, action: { kind: "ignore" } };
  const acc = current.acc + deltaY;
  if (Math.abs(acc) >= WHEEL_COMMIT) {
    return {
      state: { acc: 0, last: now, locked: true },
      action: { kind: "commit", dir: acc > 0 ? 1 : -1 },
    };
  }
  return {
    state: { ...current, acc },
    action: { kind: "follow", acc, dir: deltaY > 0 ? 1 : -1 },
  };
}

/** The wheel rested WHEEL_REST_MS after the last event: a push of at least
 *  WHEEL_SOFT moves; anything less springs back. */
export function wheelRest(state: WheelState): {
  state: WheelState;
  action: { kind: "commit"; dir: Dir } | { kind: "spring" };
} {
  if (Math.abs(state.acc) >= WHEEL_SOFT) {
    return {
      state: { acc: 0, last: state.last, locked: true },
      action: { kind: "commit", dir: state.acc > 0 ? 1 : -1 },
    };
  }
  return { state: { ...state, acc: 0 }, action: { kind: "spring" } };
}

/** A wheel event's vertical travel in px, whatever its unit. */
export function wheelDeltaPx(
  event: { deltaY: number; deltaMode: number },
  pageHeight: number,
): number {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * pageHeight;
  return event.deltaY;
}

export type KeyIntent = "forward" | "back" | "start" | null;

/** What a key means on these screens. */
export function keyIntent(key: string): KeyIntent {
  switch (key) {
    case "ArrowDown":
    case "PageDown":
    case " ":
    case "Spacebar":
      return "forward";
    case "ArrowUp":
    case "PageUp":
      return "back";
    case "Enter":
      return "start";
    default:
      return null;
  }
}

const TYPING =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/** May the recording screen take this key? Never from a field the speaker
 *  types in, never with a modifier (browser and OS shortcuts), and never
 *  while a modal dialog other than the screen itself is open (the Discard
 *  dialog owns the keys then). `root` is the screen's own element. */
export function keyIsForTheScreen(
  event: {
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
  if (target instanceof Element && target.closest(TYPING)) return false;
  return !modalOpenOver(doc, root);
}

/** A modal dialog is open that is not (inside) the screen itself. */
export function modalOpenOver(doc: Document, root: Element | null): boolean {
  const modals = doc.querySelectorAll('[aria-modal="true"]');
  for (const modal of Array.from(modals)) {
    if (!root || !modal.contains(root)) return true;
  }
  return false;
}
