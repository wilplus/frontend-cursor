/*
STORY    As a speaker, I want the wait bar to show it has started from the first second and only move on real processing updates, so that it never pretends the work is further along than it is.
OUTCOME
  O1  A document-phase wait holds its last real value when no document progress is reported.
  O2  From the first second, before anything is reported, the bar shows at least 1%.
PROVES   O1 -> elapsed time never advances the bar
         O2 -> shows 1% before the first report, and a real report takes over
WHY      Founder 2026-10-21: "at least 1% from the very first second"; a wait duration is not a processing report.
*/
import { describe, expect, it } from "vitest";
import {
  DOCUMENT_CEILING,
  WAIT_STARTED,
  waitPercent,
} from "./waitProgress";

describe("the bar spans both phases and stays honest", () => {
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

  it("holds the last real value instead of advancing from elapsed time", () => {
    expect(doc(0, { held: null })).toBe(WAIT_STARTED);
    expect(doc(0)).toBe(90);
    expect(doc(CAP * 10)).toBe(90);
    expect(doc(Number.POSITIVE_INFINITY)).toBe(90);
    expect(doc(0, { reported: 50 })).toBe(95);
    expect(doc(0, { reported: 100 })).toBe(DOCUMENT_CEILING);
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
