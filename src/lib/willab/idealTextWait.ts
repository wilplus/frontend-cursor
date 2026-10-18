/* -------------------------------------------------------------------------- */
/*  idealTextWait — the clock of a wait for a document that is not there yet.  */
/*                                                                            */
/*  FOUNDER 2026-10-18: "make it finish even when you leave the page and come */
/*  back and see the result, and not reload the last 5-10% of the loading     */
/*  again and again."                                                         */
/*                                                                            */
/*  What was happening. The Ideal Text overlay, opened on a project whose     */
/*  document the server does not have, shows the one waiting screen and asks  */
/*  again every five seconds. Two things about that wait lived only in the    */
/*  component's own memory: WHEN it began (the bar's document tail is eased   */
/*  from it) and HOW MANY times it had asked (the bound). Every remount of    */
/*  the screen started both from zero: a tab switch, a reopened overlay, a    */
/*  reload. So the bar ran its last slice, 90% to 99%, again from the start   */
/*  on every return, and the "sixty asks" bound never bound anything — the    */
/*  network tab the founder sent shows 860 requests over 27 minutes, two per  */
/*  ask, for a project that was never going to answer.                        */
/*                                                                            */
/*  Here the wait has ONE clock per project, kept in localStorage, so every   */
/*  mount of the screen reads the same start: the bar carries on from where   */
/*  it was, and the asking is paced from the real age of the wait rather than */
/*  from the component's. The asks also pause while the tab is hidden (no one */
/*  is watching the answer) and fire the moment it is visible again, which is */
/*  what "come back and see the result" needs.                                */
/*                                                                            */
/*  The marker-driven wait (a Take in flight, `processingTake`) already has   */
/*  its own persisted clock; this is for the OTHER wait, the one a project    */
/*  with no document shows, which had none.                                   */
/* -------------------------------------------------------------------------- */

import { PROCESSING_MARKER_MAX_AGE_MS } from "./processingTake";

const KEY = "willab_ideal_text_wait";

/** A wait older than this is a new wait. The same "can this still be
 *  alive at all" rule the processing marker uses; not a settle cap. */
export const IDEAL_TEXT_WAIT_MAX_AGE_MS = PROCESSING_MARKER_MAX_AGE_MS;

/** How often the pending screen asks for the document in its first minutes,
 *  the cadence it always had. */
export const PENDING_ASK_MS = 5_000;
/** After `PENDING_ASK_SLOW_AFTER_MS`, the asks slow to this: a document that
 *  has not appeared in two minutes is not going to appear in the next five
 *  seconds, and each ask costs the backend two reads. */
export const PENDING_ASK_SLOW_MS = 15_000;
export const PENDING_ASK_SLOW_AFTER_MS = 2 * 60_000;
/** The asking stops here. The screen stays as it is (no new words); the next
 *  open of the project asks again, with a fresh clock. Sixty asks at five
 *  seconds was five minutes; this is the same bound as the marker's. */
export const PENDING_ASK_FOR_MS = IDEAL_TEXT_WAIT_MAX_AGE_MS;

function storageKey(arcId: string): string {
  return `${KEY}:${arcId}`;
}

function readStart(arcId: string, now: number): number | null {
  try {
    const raw = localStorage.getItem(storageKey(arcId));
    if (!raw) return null;
    const started = Number(raw);
    if (!Number.isFinite(started) || started > now) return null;
    if (now - started > IDEAL_TEXT_WAIT_MAX_AGE_MS) return null;
    return started;
  } catch {
    return null;
  }
}

/** When the wait for this project's document began: the clock already
 *  running for it, or one started now. Every mount of the pending screen
 *  reads the same answer, which is the whole point. */
export function idealTextWaitStart(arcId: string, now = Date.now()): number {
  const existing = readStart(arcId, now);
  if (existing !== null) return existing;
  try {
    localStorage.setItem(storageKey(arcId), String(now));
  } catch {
    // Storage off (private mode, quota): the wait is clocked from now and
    // simply does not survive a reload. Nothing else changes.
  }
  return now;
}

/** The document arrived (or the project is gone): the next wait for this
 *  project, if there ever is one, starts fresh. */
export function clearIdealTextWait(arcId: string): void {
  try {
    localStorage.removeItem(storageKey(arcId));
  } catch {}
}

/** How long to wait before the next ask, given how old the wait is; null
 *  once the asking should stop. Pure, so the pacing has a test. */
export function pendingAskDelay(elapsedMs: number): number | null {
  if (!Number.isFinite(elapsedMs)) return PENDING_ASK_MS;
  if (elapsedMs >= PENDING_ASK_FOR_MS) return null;
  return elapsedMs >= PENDING_ASK_SLOW_AFTER_MS
    ? PENDING_ASK_SLOW_MS
    : PENDING_ASK_MS;
}
