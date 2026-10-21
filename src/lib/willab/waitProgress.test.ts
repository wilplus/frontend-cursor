/*
STORY    As a speaker, I want the wait bar to show it has started from the first second and never to show full until my Ideal Text is ready, so that I know it is working and a full bar means it is there now.
OUTCOME
  O1  However long the wait, the bar stops short of full until the text is ready.
  O2  From the first second, before anything is reported, the bar shows at least 1%.
PROVES   O1 -> NEVER reaches a full bar, even past the cap
         O2 -> shows 1% before the first report, and a real report takes over
WHY      Founder 2026-09-22: "100% means instant switch to the ideal text". Founder 2026-10-21: "at least 1% from the very first second".
*/
import { describe, expect, it } from "vitest";
import {
  DOCUMENT_CEILING,
  WAIT_STARTED,
  waitPercent,
} from "./waitProgress";

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

  it("NEVER reaches a full bar, even past the cap", () => {
    // THE GUARD THAT MAKES THE REST HONEST (founder 2026-09-22: "100% means
    // instant switch to the ideal text"). The last point belongs to
    // settlement, so a full bar is never something anyone waits behind.
    expect(doc(CAP)).toBeLessThanOrEqual(DOCUMENT_CEILING);
    expect(doc(CAP * 10)).toBe(DOCUMENT_CEILING);
    expect(doc(Number.POSITIVE_INFINITY)).toBe(DOCUMENT_CEILING);
  });

  it("shows 1% before the first report, and a real report takes over", () => {
    const analysis = (held: number | null, previous: number | null = null) =>
      waitPercent({ previous, held, phase: "analysis", phaseElapsedMs: 0, capMs: CAP });
    expect(WAIT_STARTED).toBe(1);
    expect(analysis(null)).toBe(1);
    expect(analysis(0)).toBe(1);
    expect(analysis(50)).toBe(45);
    expect(analysis(null, 45)).toBe(45);
  });
});
