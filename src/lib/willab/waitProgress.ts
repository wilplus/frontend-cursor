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
/*  first report there is still nothing to show, and "…" is the honest answer  */
/*  to that, exactly as it always was.                                         */
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
 *  `null` only before anything has ever been reported — there is genuinely
 *  nothing to say then, and the presentation renders "…".
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
/*  THE BAR NOW SPANS BOTH PHASES (founder 2026-09-22)                        */
/*                                                                            */
/*  "the loading is still stale after the processing is done, the building     */
/*   text is simply stale there … ensure that the progress bar ends when the   */
/*   full processing AND the text building is done so that 100% means instant  */
/*   switch to the ideal text."                                                */
/*                                                                            */
/*  THIS REVERSES THE 2026-09-19 RULING ABOVE, and deliberately — on the       */
/*  founder's word, with the reason the old ruling was right now answered.     */
/*                                                                            */
/*  That ruling refused a moving document tail because "94% on a screen is     */
/*  read as 94% done, which is a claim nothing here can make". True while the  */
/*  bar claimed to measure WORK. The founder has now defined what it measures: */
/*  the WAIT, ending exactly when the speaker can read their text. Under that  */
/*  definition the document phase's elapsed time against its own real deadline */
/*  is not an invention — it is the quantity the bar is for.                   */
/*                                                                            */
/*  Two guards keep it honest, and they are the whole design:                  */
/*                                                                            */
/*  1. THE TOP OF THE BAR IS RESERVED FOR THE REAL EVENT. Reported analysis    */
/*     progress is scaled into 0..ANALYSIS_CEILING, the document tail eases    */
/*     from there to DOCUMENT_CEILING and stops. Nothing but settlement can    */
/*     print a full bar, so a full bar is never a promise that goes unkept.    */
/*     The speaker never sees a finished bar and then waits — which is         */
/*     precisely what "100% means instant switch" asks for.                    */
/*                                                                            */
/*  2. THE TAIL DECELERATES. `1 - e^(-3t)` covers most of its slice in the     */
/*     first third of the cap and crawls after. A tail that marched at a       */
/*     constant rate would imply a known finish; this one says "still working, */
/*     and I am less and less sure how long", which is the truth.              */
/*                                                                            */
/*  Before any analysis report there is still nothing to show and "…" is still */
/*  the answer — except in the document phase, which has a real clock of its   */
/*  own and so can speak even when the analysis phase never reported.          */
/* -------------------------------------------------------------------------- */

/** Where the analysis phase's own 100% lands on the shared bar. */
export const ANALYSIS_CEILING = 90;

/** The highest the bar may reach before the document is actually served.
 *  The remaining point belongs to settlement, and settlement is the switch. */
export const DOCUMENT_CEILING = 99;

/** How far into its slice the document tail has crawled, 0..1.
 *
 *  Decelerating on purpose (see 2 above). `capMs` is the document phase's
 *  real deadline — `DOCUMENT_SETTLE_CAP_MS` — so the curve is shaped by the
 *  same bound that decides when the screen gives up, not by a number chosen
 *  to look good.
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
 *  `held` is the analysis phase's own percent as `nextWaitPercent` maintains
 *  it: real while reported, held afterwards, null before the first report.
 *  `previous` is what this function last returned, so the bar can never fall
 *  across a phase change either.
 */
export function waitPercent({
  previous,
  held,
  reported,
  phase,
  phaseElapsedMs,
  capMs,
}: {
  previous: number | null;
  held: number | null;
  /** The percent reported for THIS tick, unheld. Only the document phase
   *  reads it, and only to prefer a real number over its own clock. */
  reported?: number | null;
  phase: "analysis" | "document";
  phaseElapsedMs: number;
  capMs: number;
}): number | null {
  const floor = clamp(previous);
  const scaled = share(clamp(held), 0, ANALYSIS_CEILING);
  if (phase === "analysis") {
    if (scaled === null) return floor === null ? null : Math.round(floor);
    return Math.round(floor === null ? scaled : Math.max(floor, scaled));
  }
  /* THE DOCUMENT PHASE OWNS THE TOP SLICE.
   *
   * A reported percent still wins when one exists — that is the version this
   * file has always said was worth building, and the day the backend reports
   * document progress this line is already waiting for it. Today it never
   * does: the marker is rewritten `{stage: "document_assembly", percent:
   * null}` at the handover and nothing updates it again, so the clock is all
   * there is. Whichever speaks, the answer is inside the slice, and the slice
   * stops one point short of full. */
  const fromReport = share(clamp(reported), ANALYSIS_CEILING, DOCUMENT_CEILING);
  const fromClock =
    ANALYSIS_CEILING +
    (DOCUMENT_CEILING - ANALYSIS_CEILING) *
      documentTailFraction(phaseElapsedMs, capMs);
  return Math.round(
    Math.min(
      DOCUMENT_CEILING,
      Math.max(
        ANALYSIS_CEILING,
        scaled ?? 0,
        floor ?? 0,
        fromReport ?? 0,
        fromClock,
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
