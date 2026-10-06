/* -------------------------------------------------------------------------- */
/*  HOW THE FEEDBACK WALK'S SCREENS MOVE (founder lock 2026-10-06,             */
/*  "How screens move, everywhere in the app")                                 */
/*                                                                            */
/*  A port of the locked prototype's animate(): given the screen that was on   */
/*  show, the one that is now, and the direction the speaker asked for, pick   */
/*  exactly one move. The CSS that draws each move lives in globals.css under  */
/*  "feedback walk motion"; this file only decides which one.                  */
/*                                                                            */
/*    open   the overlay rises over the page (0.38 s)                          */
/*    close  the overlay sinks, the page already underneath (0.28 s)           */
/*    next   the top bar stays; old content slips left, new slides in right    */
/*    back   the mirror of next                                                */
/*    fade   a soft cross-fade with a slight lift (0.34 s): the screens that   */
/*           stand apart, and one moment changing state                        */
/*    none   nothing moves: the same screen redrawn (a tick, a word)           */
/*                                                                            */
/*  Pure, so every rule is a unit test rather than a comment.                 */
/* -------------------------------------------------------------------------- */

export type WalkMove = "open" | "close" | "next" | "back" | "fade" | "none";

/** What the speaker asked for. Absent means "forward, as the screen says". */
export type WalkDir = "forward" | "back" | "fade" | "none";

/** One screen of the walk, as far as motion cares. */
export type WalkScreen = {
  /** The screen's kind: "praise", "judge", "processing", … */
  key: string;
  /** The moment it is about, when it is about one. */
  moment?: number | null;
  /** Which try of the practise loop. */
  attempt?: number;
  /** A variant of the same screen ("words" or "instruction" practise). */
  kind?: string;
  /** False for a screen that is the page itself (no overlay over it). */
  overlay?: boolean;
};

/** Screens that stand apart from the moments: "Judgement time!" and sharing. */
export const WALK_APART: ReadonlySet<string> = new Set(["intro", "community"]);

/** One moment changing state after a try: checking, then praise or
 *  encouragement. A practise moving into any of them cross-fades too. */
export const WALK_SAME_MOMENT: ReadonlySet<string> = new Set([
  "processing",
  "improved",
  "encourage",
]);

const PRACTISE = "practise";

/** The identity a redraw must keep to count as "the same screen". */
export function walkSig(screen: WalkScreen): string {
  return [screen.key, screen.moment ?? "", screen.attempt ?? 0, screen.kind ?? ""].join(":");
}

export function isOverlay(screen: WalkScreen | null | undefined): boolean {
  return Boolean(screen) && screen?.overlay !== false;
}

/** One moment changing state: practise → checking → praise/encouragement. */
function sameMomentChange(prev: WalkScreen, next: WalkScreen): boolean {
  if (!WALK_SAME_MOMENT.has(next.key) || prev.key === next.key) return false;
  return prev.key === PRACTISE || WALK_SAME_MOMENT.has(prev.key);
}

/** Inside the overlay: slide, mirror, or cross-fade. */
function swapMove(prev: WalkScreen, next: WalkScreen, dir: WalkDir | undefined): WalkMove {
  if (dir === "fade") return "fade";
  if (WALK_APART.has(next.key) || WALK_APART.has(prev.key)) return "fade";
  if (sameMomentChange(prev, next)) return "fade";
  return dir === "back" ? "back" : "next";
}

/** The one move from `prev` to `next`. */
export function moveFor(
  prev: WalkScreen | null | undefined,
  next: WalkScreen,
  dir?: WalkDir,
): WalkMove {
  if (!prev || dir === "none") return "none";
  // The same screen redrawn (a tick, a word) does not move — unless the
  // speaker explicitly asked to go somewhere.
  if (walkSig(prev) === walkSig(next) && !dir) return "none";
  const was = isOverlay(prev);
  const is = isOverlay(next);
  if (was && is) return swapMove(prev, next, dir);
  if (!was && is) return "open";
  if (was && !is) return "close";
  return "none";
}

/** Does this move keep a copy of the leaving screen for its out-animation? */
export function leavesCopy(move: WalkMove): boolean {
  return move === "next" || move === "back" || move === "fade" || move === "close";
}

/** How long a leaving copy is kept (the prototype's ghost lifetime). */
export const WALK_LEAVE_MS = 360;

/** A chosen answer fills black and holds this long before the walk moves. */
export const WALK_ANSWER_HOLD_MS = 280;

/** The toast's whole life, rising in and fading out. */
export const WALK_TOAST_MS = 1600;
