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
