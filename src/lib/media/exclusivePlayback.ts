/* -------------------------------------------------------------------------- */
/*  One player at a time (founder 2026-10-08, "make sure the playbacks work    */
/*  all across the app").                                                     */
/*                                                                            */
/*  Every player of the speaker's or the coach's voice tells this module when */
/*  its element starts; whichever element was playing before is paused. Two   */
/*  clips talking over each other is never what a tap asked for.              */
/*                                                                            */
/*  Explicit, not a document-wide `play` listener: the camera's live preview  */
/*  is a playing <video> too, and must never be paused by a clip (or pause    */
/*  one).                                                                     */
/* -------------------------------------------------------------------------- */

let current: HTMLMediaElement | null = null;

/** Call from a player's `play` event: pauses whichever other one plays. */
export function claimPlayback(element: HTMLMediaElement): void {
  if (current && current !== element && !current.paused) {
    try {
      current.pause();
    } catch {
      // A detached element can refuse; it is not playing anything we hear.
    }
  }
  current = element;
}

/** Call when a player's element pauses, ends or unmounts. */
export function releasePlayback(element: HTMLMediaElement | null): void {
  if (element && current === element) current = null;
}
