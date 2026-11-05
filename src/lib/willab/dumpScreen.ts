/* -------------------------------------------------------------------------- */
/*  The dump screen's rules (backend N506, N507): the words, the switch, when  */
/*  it opens first, and how a tap is read. No React here, so the rules can be */
/*  read and tested on their own. The screen: components/willab/DumpScreen.   */
/*                                                                            */
/*  Taps act at once. A second tap soon after, and close to the first, is a   */
/*  double tap: it undoes the first tap and closes. So a start that lasted    */
/*  under 0.3 s is thrown away, and a double tap while talking stops, keeps   */
/*  and closes (N506 item 2).                                                 */
/* -------------------------------------------------------------------------- */

/** Every word on the dump screen and its Settings row. All signed (N506
 *  item 7, N507 item 4); the notebook's introduction is N411's, signed. */
export const DUMP_COPY = {
  idle: "Say it.",
  idleHint: "Tap anywhere",
  listening: "Listening",
  tapToStop: "Tap to stop",
  kept: "Kept",
  tapToSayMore: "Tap to say more",
  doubleTapToClose: "Double tap to close",
  switchLabel: "Open to the dump screen",
  switchLine: "First thing when you open the app, at most once an hour.",
  // N411 item 1, signed: the notebook's introduction, shown once before the
  // screen first listens (N507 item 1).
  introLead:
    "🎙 Tap the mic any time and say what's on your mind. It helps you catch negative thinking and self-sabotage. One privacy rule first:",
  introNote: [
    "Nothing fragile: health, family, money, address.",
    "We look for patterns, not secrets. Fewer clues, less for hackers.",
    "📓 For journalling try paper notebook 😉",
  ],
  introAsk: "Do you understand the rules and want this feature on?",
  yes: "Yes",
  notNow: "Not now",
} as const;

/** The ring row (N507 item 3). */
export const DUMP_FEATURE = "dump_screen";

export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_PX = 60;
export const OPEN_GUARD_MS = 500;
export const MOVE_PX = 12;
export const PALM_PX = 60;
export const SWIPE_CLOSE_PX = 90;
export const OPEN_EVERY_MS = 60 * 60 * 1000;
export const HINT_DUMPS = 3;

/* ------------------------------ how a tap reads ---------------------------- */

export type TapAction =
  | { kind: "start" }
  | { kind: "stop" }
  | { kind: "close"; undoStart: boolean }
  | { kind: "ignore" };

export interface Touch {
  at: number;
  x: number;
  y: number;
  /** Where the finger went down: a touch that moved is a swipe, not a tap. */
  downX: number;
  downY: number;
  /** The contact's size (PointerEvent width/height); a palm is large. */
  size: number;
  /** More than one finger on the screen. */
  multi: boolean;
}

export interface TapMemory {
  openedAt: number;
  last: { at: number; x: number; y: number; started: boolean } | null;
}

export function freshMemory(openedAt: number): TapMemory {
  return { openedAt, last: null };
}

/** Reads one tap. `listening`: was it listening before this tap. Returns the
 *  action and the memory for the next tap. */
export function readTap(memory: TapMemory, touch: Touch, listening: boolean): [TapAction, TapMemory] {
  const ignore: [TapAction, TapMemory] = [{ kind: "ignore" }, memory];
  if (touch.at - memory.openedAt < OPEN_GUARD_MS) return ignore;
  if (touch.multi || touch.size > PALM_PX) return ignore;
  if (Math.hypot(touch.x - touch.downX, touch.y - touch.downY) > MOVE_PX) return ignore;

  const last = memory.last;
  if (last && touch.at - last.at < DOUBLE_TAP_MS && Math.hypot(touch.x - last.x, touch.y - last.y) < DOUBLE_TAP_PX) {
    return [{ kind: "close", undoStart: last.started }, { ...memory, last: null }];
  }
  const started = !listening;
  return [
    started ? { kind: "start" } : { kind: "stop" },
    { ...memory, last: { at: touch.at, x: touch.x, y: touch.y, started } },
  ];
}

/* ------------------------- the switch and its memory ----------------------- */
/*  Kept on this device: opening first is about this phone (N507 item 2).    */

const KEY_ON = "willab.dump.openFirst";
const KEY_SHOWN = "willab.dump.lastShown";
const KEY_KEPT = "willab.dump.kept";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private window: the switch lasts for this page */
  }
}

export function openFirst(): boolean {
  return read(KEY_ON) === "1";
}
export function setOpenFirst(on: boolean): void {
  write(KEY_ON, on ? "1" : "0");
  if (on) write(KEY_SHOWN, "0");
}

/** Opens first only when switched on, and at most once an hour. */
export function dueToOpen(now: number): boolean {
  if (!openFirst()) return false;
  const last = Number(read(KEY_SHOWN) ?? "0");
  return !Number.isFinite(last) || now - last >= OPEN_EVERY_MS;
}
export function markShown(now: number): void {
  write(KEY_SHOWN, String(now));
}

/** "Double tap to close" shows for the first three dumps only. */
export function showHint(): boolean {
  return Number(read(KEY_KEPT) ?? "0") < HINT_DUMPS;
}
export function countKept(): void {
  write(KEY_KEPT, String(Number(read(KEY_KEPT) ?? "0") + 1));
}

/* --------------------------- the pull down (N517) -------------------------- */
/*  A pull down that starts on the top bar of the chat list or Will's chat    */
/*  opens the dump screen. Only /chat registers an opener, and only where    */
/*  the ring row is on, so the top bar on any other page does nothing.       */

export const PULL_OPEN_PX = 90;

let opener: (() => void) | null = null;

export function setDumpOpener(fn: (() => void) | null): void {
  opener = fn;
}
export function canPullDump(): boolean {
  return opener !== null;
}
export function openDumpScreen(): void {
  opener?.();
}
