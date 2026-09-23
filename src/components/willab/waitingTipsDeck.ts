/* -------------------------------------------------------------------------- */
/*  waitingTipsDeck — where the reader is in the advice, and how they move.    */
/*                                                                            */
/*  The pure half of the waiting-screen tips, kept out of the component for    */
/*  the usual reason: a place that must survive a remount is worth testing     */
/*  without a DOM.                                                            */
/* -------------------------------------------------------------------------- */

/** Where each job's reader had got to. Keyed on the cycle epoch, which is the
 *  same value every view of one job already shares.
 *
 *  MODULE LEVEL, NOT STATE, and that is the point rather than a shortcut. The
 *  waiting screen unmounts and remounts inside a single wait — the analysis
 *  phase hands over to the document phase, an overlay closes and reopens — and
 *  component state dies with each of those. Resetting to the first tip every
 *  time would take the reader back to the top of something they were halfway
 *  through, which is exactly what `waitingTips.ts` says must not happen: "the
 *  exact scroll position survives every processing screen".
 *
 *  Not sessionStorage: this needs to survive a remount, not a reload, and a
 *  reload genuinely is a new sitting. It also keeps the screen free of a
 *  storage read that can throw in a private window. */
const PLACE_BY_CYCLE = new Map<number, number>();

/** Bounded so a long-lived tab cannot accumulate one entry per job forever.
 *  Waits are minutes long, so a handful of recent jobs is every job anyone
 *  could still be looking at. */
const MAX_REMEMBERED = 8;

export function rememberedPlace(cycleEpoch: number, count: number): number {
  const at = PLACE_BY_CYCLE.get(cycleEpoch);
  if (typeof at !== "number") return 0;
  return clampPlace(at, count);
}

export function rememberPlace(cycleEpoch: number, at: number): void {
  if (PLACE_BY_CYCLE.size >= MAX_REMEMBERED && !PLACE_BY_CYCLE.has(cycleEpoch)) {
    const oldest = PLACE_BY_CYCLE.keys().next();
    if (!oldest.done) PLACE_BY_CYCLE.delete(oldest.value);
  }
  PLACE_BY_CYCLE.set(cycleEpoch, at);
}

/** Test seam. Nothing in the app calls it. */
export function forgetPlaces(): void {
  PLACE_BY_CYCLE.clear();
}

export function clampPlace(at: number, count: number): number {
  if (!Number.isFinite(at) || count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.trunc(at)));
}

/** Which panel a scroll position is showing: the nearest one, so a half-way
 *  drag that the browser is about to snap forward reports the destination
 *  rather than the panel being left. */
export function placeFromScroll(
  scrollTop: number,
  panelHeight: number,
  count: number
): number {
  if (!Number.isFinite(panelHeight) || panelHeight <= 0) return 0;
  return clampPlace(Math.round(scrollTop / panelHeight), count);
}
