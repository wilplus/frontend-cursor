import { describe, expect, it } from "vitest";
import {
  DOCUMENT_CEILING,
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

});
