/* -------------------------------------------------------------------------- */
/*  waitProgress — ONE bar across the WHOLE wait (founder 2026-09-19)          */
/*                                                                            */
/*  "The loading doesn't show the percentages, it just shows that it builds    */
/*   and then shows the ideal text — there is no continuity there and it       */
/*   feels like it's stale."                                                   */
/*                                                                            */
/*  It was not stale. The document was current and the worker had finished in  */
/*  seventeen seconds. What the speaker actually saw was a bar that went       */
/*  BACKWARDS: the analysis phase reports a real percent and climbs, the       */
/*  document phase is seeded `{stage: "ideal_text", percent: null}`, and the   */
/*  presentation renders a null as `"…"` at `width: 0%`. So the bar filled,    */
/*  collapsed to nothing, sat empty, and then the text appeared from nowhere.  */
/*  Nothing was broken and it read as broken, which for that speaker is the    */
/*  same thing.                                                                */
/*                                                                            */
/*  THE RULE IS HOLD, NOT INVENT.                                              */
/*                                                                            */
/*  The first version of this file advanced the bar through the document phase */
/*  on elapsed time against that phase's cap. The gate refused it, and the     */
/*  gate was right: `ProcessingWait.test.tsx` carries the line "No percentage  */
/*  invented when the backend exposes none", and elapsed time is exactly that  */
/*  — the code may call it "how long we have waited", but `94%` on a screen    */
/*  is read as "94% done", which is a claim nothing here can make.             */
/*                                                                            */
/*  So: a real percent is shown, a missing one HOLDS the last real percent,    */
/*  and the bar can never fall. That removes the collapse — which was the      */
/*  whole defect — without any number the backend did not report. Before the   */
/*  first report the bar shows 1%, the honest acknowledgement that the wait    */
/*  has begun.                                                                  */
/*                                                                            */
/*  A moving bar through the document phase needs the BACKEND to report        */
/*  progress there. That is the version worth building, and it is a different  */
/*  change on the other side of the wire.                                      */
/*                                                                            */
/*  Pure, and here rather than in the component, for the reason deckScroll     */
/*  and measureScreenFit give: vitest cannot transform .tsx imports, so a rule */
/*  left inside a component is a rule no unit test can reach.                  */
/* -------------------------------------------------------------------------- */

/** The percentage to show now: the reported one, or the last one shown.
 *
 *  `null` only before anything has ever been reported; the presentation's
 *  1%-floor turns that into a visible acknowledgement that the wait began.
 */
export function nextWaitPercent(
  previous: number | null,
  reported: number | null,
): number | null {
  const measured =
    typeof reported === "number" && Number.isFinite(reported)
      ? Math.max(0, Math.min(100, reported))
      : null;
  const held =
    typeof previous === "number" && Number.isFinite(previous)
      ? Math.max(0, Math.min(100, previous))
      : null;
  if (measured === null) return held;
  if (held === null) return measured;
  // MONOTONIC. A bar that falls reads as the work being lost and started
  // again — which is what the phase handover looked like, and it is why a
  // finished document felt stale.
  return Math.max(held, measured);
}

/* -------------------------------------------------------------------------- */
/*  THE BAR SPANS BOTH PHASES WITHOUT INVENTING PROGRESS.                     */
/*                                                                            */
/*  Analysis progress is mapped into the lower slice of the shared bar. The   */
/*  document phase keeps that last real value unless the backend supplies a    */
/*  new document-phase value. An elapsed-time animation is deliberately not   */
/*  used: time spent waiting is not evidence that the work is further along.   */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  THE BAR STARTS AT 1% (founder 2026-10-21: "when the processing starts it   */
/*  should show at least 1% from the very first second so that user knows it   */
/*  has at least started").                                                    */
/*                                                                            */
/*  This replaces the "…" above. The upload and the first report can take     */
/*  seconds, and an empty bar with "…" read as nothing happening. 1% claims    */
/*  only what is true from the first second: the wait has begun. A real report */
/*  takes over the moment it is higher, and the bar still never falls.        */
/* -------------------------------------------------------------------------- */

/** The least the bar shows once the wait has begun. */
export const WAIT_STARTED = 1;

/** Where the analysis phase's own 100% lands on the shared bar. */
export const ANALYSIS_CEILING = 90;

/** The highest pre-settlement value when a document-phase report is available. */
export const DOCUMENT_CEILING = 99;

/** Legacy pure curve helper retained for callers that still model settlement.
 *  The speaker-facing wait does not use elapsed time as progress evidence.
 */
export function documentTailFraction(
  elapsedMs: number,
  capMs: number,
): number {
  // An infinite elapsed is SATURATION, not garbage: `Number.isFinite` would
  // read it as "no elapsed time" and send the bar back to the bottom of its
  // slice, which is the one direction it may never go.
  if (Number.isNaN(elapsedMs) || elapsedMs <= 0) return 0;
  if (!Number.isFinite(capMs) || capMs <= 0) return 1;
  return 1 - Math.exp((-3 * Math.min(elapsedMs, capMs)) / capMs);
}

/** The percentage the wait screen shows, across both phases.
 *
 *  `held` is the latest backend-authored value for the current job. Missing
 *  values hold the previous display, and the first display is the honest 1%
 *  acknowledgement that processing has started. The document phase does not
 *  advance from elapsed time.
 */
export function waitPercent({
  previous,
  held,
  reported,
  phase,
  // Kept in the public shape for the document-settle callers. Neither value
  // is evidence of processing progress.
  phaseElapsedMs: _phaseElapsedMs,
  capMs: _capMs,
}: {
  previous: number | null;
  held: number | null;
  /** The percent reported for THIS tick, unheld. The document phase reads it
   *  only when the backend supplies a real value. */
  reported?: number | null;
  phase: "analysis" | "document";
  phaseElapsedMs: number;
  capMs: number;
}): number {
  const floor = clamp(previous);
  const scaled = share(clamp(held), 0, ANALYSIS_CEILING);
  if (phase === "analysis") {
    return Math.round(Math.max(WAIT_STARTED, floor ?? 0, scaled ?? 0));
  }
  /* THE DOCUMENT PHASE OWNS THE TOP SLICE when it has a real report. Today it
   * usually has `percent: null`, so the bar simply holds the analysis value.
   * A clock must never manufacture a completion-looking value. */
  const fromReport = share(clamp(reported), ANALYSIS_CEILING, DOCUMENT_CEILING);
  return Math.round(
    Math.min(
      100,
      Math.max(
        WAIT_STARTED,
        scaled ?? 0,
        floor ?? 0,
        fromReport ?? 0,
      ),
    ),
  );
}

/** A percent, or null when there is no usable number. */
function clamp(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : null;
}

/** A 0..100 percent placed inside the slice `low..high` of the shared bar. */
function share(
  value: number | null,
  low: number,
  high: number,
): number | null {
  return value === null ? null : low + ((high - low) * value) / 100;
}
