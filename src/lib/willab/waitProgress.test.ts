import { describe, expect, it } from "vitest";
import {
  ANALYSIS_CEILING,
  DOCUMENT_CEILING,
  documentTailFraction,
  waitPercent,
} from "./waitProgress";

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

describe("the bar spans both phases and stops short of full", () => {
  const CAP = 120_000;
  const doc = (elapsed: number, over: Partial<Parameters<typeof waitPercent>[0]> = {}) =>
    waitPercent({
      previous: null,
      held: 100,
      phase: "document",
      phaseElapsedMs: elapsed,
      capMs: CAP,
      ...over,
    });

  it("gives the analysis phase the lower nine tenths, so its 100 is not the bar's", () => {
    // The whole point of reserving the top: a speaker who sees the analysis
    // finish has not been told their text is ready.
    expect(
      waitPercent({
        previous: null,
        held: 100,
        phase: "analysis",
        phaseElapsedMs: 0,
        capMs: CAP,
      }),
    ).toBe(ANALYSIS_CEILING);
  });

  it("scales a mid-analysis report into that slice", () => {
    expect(
      waitPercent({
        previous: null,
        held: 50,
        phase: "analysis",
        phaseElapsedMs: 0,
        capMs: CAP,
      }),
    ).toBe(45);
  });

  it("hands over at the ceiling rather than collapsing or jumping", () => {
    expect(doc(0)).toBe(ANALYSIS_CEILING);
  });

  it("keeps moving through a phase the backend says nothing about", () => {
    // The founder's "the building text is simply stale there" — measured.
    const early = doc(5_000);
    const later = doc(30_000);
    expect(later).toBeGreaterThan(early!);
    expect(early!).toBeGreaterThan(ANALYSIS_CEILING);
  });

  it("decelerates rather than marching at a constant rate", () => {
    // A steady march implies a known finish. This one says "still working,
    // and less and less sure how long".
    const firstThird = doc(40_000)! - doc(0)!;
    const lastThird = doc(120_000)! - doc(80_000)!;
    expect(firstThird).toBeGreaterThan(lastThird);
  });

  it("NEVER reaches a full bar, even past the cap", () => {
    // THE GUARD THAT MAKES THE REST HONEST (founder 2026-09-22: "100% means
    // instant switch to the ideal text"). The last point belongs to
    // settlement, so a full bar is never something anyone waits behind.
    expect(doc(CAP)).toBeLessThanOrEqual(DOCUMENT_CEILING);
    expect(doc(CAP * 10)).toBe(DOCUMENT_CEILING);
    expect(doc(Number.POSITIVE_INFINITY)).toBe(DOCUMENT_CEILING);
  });

  it("prefers a real document report over its own clock", () => {
    // The version this file always said was worth building. The day the
    // backend reports document progress, this line is already waiting.
    expect(doc(0, { reported: 100 })).toBe(DOCUMENT_CEILING);
    expect(doc(0, { reported: 50 })).toBe(95);
  });

  it("still never falls, across the phase change or within one", () => {
    expect(doc(0, { previous: 97 })).toBe(97);
    expect(
      waitPercent({
        previous: 45,
        held: 10,
        phase: "analysis",
        phaseElapsedMs: 0,
        capMs: CAP,
      }),
    ).toBe(45);
  });

  it("says nothing in the analysis phase before anything is reported", () => {
    // Unchanged: the analysis phase has no clock of its own to speak from.
    expect(
      waitPercent({
        previous: null,
        held: null,
        phase: "analysis",
        phaseElapsedMs: 9_000,
        capMs: CAP,
      }),
    ).toBeNull();
  });

  it("speaks in the document phase even when analysis never reported", () => {
    // It CAN speak here: this phase has a real deadline of its own, which is
    // the quantity the bar measures.
    expect(
      doc(10_000, { held: null }),
    ).toBeGreaterThanOrEqual(ANALYSIS_CEILING);
  });

  it("tolerates a nonsense cap without dividing by zero", () => {
    expect(doc(1_000, { capMs: 0 })).toBe(DOCUMENT_CEILING);
    expect(documentTailFraction(1_000, 0)).toBe(1);
    expect(documentTailFraction(-5, CAP)).toBe(0);
  });
});
