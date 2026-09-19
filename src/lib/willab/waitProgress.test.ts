import { describe, expect, it } from "vitest";

import { nextWaitPercent } from "@/lib/willab/waitProgress";

/* -------------------------------------------------------------------------- */
/*  A PROGRESS BAR MAY NOT GO BACKWARDS                                        */
/*  (founder 2026-09-19: "the loading doesn't show the percentages, it just    */
/*   shows that it builds and then shows the ideal text — there is no          */
/*   continuity there and it feels like it's stale")                           */
/*                                                                            */
/*  It was not stale. The worker had finished in seventeen seconds and the     */
/*  document was current. What the speaker saw was the analysis phase climb,   */
/*  then the document phase seed `percent: null`, which the presentation       */
/*  renders as "…" at width 0 — so the bar filled, collapsed to nothing, sat   */
/*  empty, and the text then appeared from nowhere.                            */
/*                                                                            */
/*  HOLD, DO NOT INVENT. The first attempt at this advanced the bar through    */
/*  the document phase on elapsed time. The gate refused it, because           */
/*  `ProcessingWait.test.tsx` says "No percentage invented when the backend    */
/*  exposes none" — and `94%` on a screen is read as "94% done" whatever the   */
/*  code comment calls it. Holding the last REAL percent removes the collapse  */
/*  without claiming anything.                                                 */
/* -------------------------------------------------------------------------- */

describe("the bar holds rather than falling", () => {
  it("holds the last real percent when the report disappears", () => {
    // THE BUG, in one line: this is the analysis → document handover, and
    // the answer used to be null, drawn as "…" on an empty rail.
    expect(nextWaitPercent(85, null)).toBe(85);
  });

  it("keeps the higher value when a later report is lower", () => {
    expect(nextWaitPercent(72, 10)).toBe(72);
  });

  it("still rises when the report genuinely rises", () => {
    expect(nextWaitPercent(40, 62)).toBe(62);
  });

  it("holds across a whole silent phase, not just one tick", () => {
    let shown: number | null = 85;
    for (let i = 0; i < 120; i += 1) shown = nextWaitPercent(shown, null);
    expect(shown).toBe(85);
  });
});

describe("it invents nothing", () => {
  it("shows nothing before anything has been reported", () => {
    // "…" is the honest answer to a wait that has not reported yet, and it
    // stays the answer. The fix is about not FALLING, not about filling.
    expect(nextWaitPercent(null, null)).toBeNull();
  });

  it("takes the first real report as-is", () => {
    // No band, no scaling: 62 means 62. The percentage on screen is the
    // backend's number, not a projection of it.
    expect(nextWaitPercent(null, 62)).toBe(62);
  });
});

describe("it tolerates the shapes a real marker produces", () => {
  it("treats a non-finite report as no report", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(nextWaitPercent(50, bad)).toBe(50);
      expect(nextWaitPercent(null, bad)).toBeNull();
    }
  });

  it("clamps a report outside 0..100", () => {
    expect(nextWaitPercent(null, 150)).toBe(100);
    expect(nextWaitPercent(null, -20)).toBe(0);
  });

  it("clamps a held value it was handed out of range", () => {
    expect(nextWaitPercent(400, null)).toBe(100);
  });
});
