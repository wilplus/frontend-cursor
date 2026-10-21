/* -------------------------------------------------------------------------- */
/*  THE WAIT LIFTS ONTO THE WALK, NOT BEFORE IT (founder 2026-10-21: "when it  */
/*  says it's done it opens the walk automatically but then it still loads    */
/*  the walk - so it is not done!").                                           */
/*                                                                            */
/*  The wait screen used to close the moment the Take's text was stored, and  */
/*  the lens then opened on its own loading frame (the ✕ and the typing dots)  */
/*  while the page, its marks and its deck came in. Done, then loading again.  */
/*  Now the wait stays over the lens until there is something to see: a step   */
/*  of the walk on screen, or the lens giving way to the text because there   */
/*  is nothing to walk.                                                        */
/*                                                                            */
/*  Pure, so the rule can be stated in a test; the Lounge's useWaitScreen      */
/*  asks it while the wait covers the lens.                                    */
/* -------------------------------------------------------------------------- */

import { SETTLE_CEILING_MS } from "./enrichmentSettle";
import { LENS_WATCHDOG_MS } from "./lensScreen";

/** The lens screen's own frame while the walk loads (IdealTextOverlay's
 *  LensFrame): the typing dots the wait now covers. */
export const LENS_SCREEN_SELECTOR = "[data-lens-screen]";

/** How often the covering wait looks for the walk. Short: the switch is the
 *  moment the walk is there, and a look is one query. */
export const WAIT_LOOK_MS = 50;

/** No lens by now means something else opened in its place (a gate, an
 *  error): the wait steps aside rather than hide it. */
export const LENS_APPEAR_MS = 5_000;

/** The last resort: the page's own patience for its marks, then the lens's
 *  last resort. Past this the lens speaks for itself. */
export const WAIT_COVER_CAP_MS = SETTLE_CEILING_MS + LENS_WATCHDOG_MS;

export interface WaitCover {
  /** A step of the walk is on screen. */
  stepOnScreen: boolean;
  /** The lens's loading frame has been on screen at some point. */
  lensSeen: boolean;
  /** The lens's loading frame is on screen now. */
  lensOn: boolean;
  /** How long the wait has covered the lens. */
  elapsedMs: number;
}

/** True when the wait may lift: the walk is there, or the lens is gone (the
 *  text is up, or the lens closed), or no lens ever came, or the cap. */
export function waitLifts(cover: WaitCover): boolean {
  if (cover.stepOnScreen) return true;
  if (cover.lensSeen) return !cover.lensOn || cover.elapsedMs > WAIT_COVER_CAP_MS;
  return cover.elapsedMs > LENS_APPEAR_MS;
}
