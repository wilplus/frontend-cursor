import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  fitChangedMeaningfully,
  tightestFit,
} from "@/lib/willab/measureScreenFit";
import type { ScreenFit } from "@/lib/willab/deckScroll";

/* -------------------------------------------------------------------------- */
/*  ONE BUDGET FOR SCREENS THAT ARE NOT THE SAME HEIGHT                        */
/*  (founder 2026-09-19: "the large slide that should have been truncated      */
/*   into two slides is not")                                                  */
/*                                                                            */
/*  The deck measured whichever screen was active and packed the whole         */
/*  document to that one number. Harmless while every header matched; wrong    */
/*  the moment the slide picture came back, because a FIRST screen carries a   */
/*  picture and a CONTINUATION does not. Measured on a continuation, the       */
/*  budget was a slide too tall, the packing believed an over-tall paragraph   */
/*  fit, and the split it exists to perform stopped happening.                 */
/*                                                                            */
/*  On a phone this needs no scrolling to trigger: the remeasure runs on       */
/*  `resize`, and the URL bar sliding is a resize.                             */
/*                                                                            */
/*  Only the pure rules are testable here — jsdom reports every clientHeight   */
/*  as 0, which is exactly why `measureScreenFit` returns null rather than a   */
/*  confident zero, and why the packing lives outside the DOM at all.          */
/* -------------------------------------------------------------------------- */

const fit = (over: Partial<ScreenFit> = {}): ScreenFit => ({
  budgetPx: 600,
  lineHeightPx: 29,
  charsPerLine: 40,
  gapPx: 16,
  ...over,
});

/** A first screen gives up ~38vh of its height to the slide above the words;
 *  a continuation screen keeps it. These are the two real cases. */
const WITH_PICTURE = fit({ budgetPx: 280 });
const WITHOUT_PICTURE = fit({ budgetPx: 610 });

describe("the tightest screen sets the budget", () => {
  it("takes the screen with the least room, not the first one offered", () => {
    // THE BUG, in one line: measured in this order, the deck used to adopt
    // 610px and pack a 280px screen to it.
    expect(tightestFit([WITHOUT_PICTURE, WITH_PICTURE])?.budgetPx).toBe(280);
  });

  it("does not depend on the order they were measured in", () => {
    expect(tightestFit([WITH_PICTURE, WITHOUT_PICTURE])?.budgetPx).toBe(280);
  });

  it("ignores screens that could not be measured", () => {
    // Unmounted screens and pre-layout reads come back null; a null is the
    // absence of a measurement, never a screen with no room.
    expect(tightestFit([null, WITHOUT_PICTURE, null])?.budgetPx).toBe(610);
  });

  it("is null when nothing could be measured", () => {
    // The deck then keeps the fixed count of three it always had, rather than
    // packing to a number it does not have.
    expect(tightestFit([])).toBeNull();
    expect(tightestFit([null, null])).toBeNull();
  });

  it("keeps the whole fit of the tightest screen, not a mix of them", () => {
    // Line height and characters-per-line belong to the screen that owns the
    // budget. Taking the smallest of each field independently would describe
    // a screen that does not exist.
    const narrow = fit({ budgetPx: 280, lineHeightPx: 22, charsPerLine: 51 });
    const wide = fit({ budgetPx: 610, lineHeightPx: 29, charsPerLine: 40 });
    expect(tightestFit([wide, narrow])).toEqual(narrow);
  });
});

describe("the repack guard still only fires on a real change", () => {
  it("adopts the first measurement there is", () => {
    expect(fitChangedMeaningfully(null, fit())).toBe(true);
  });

  it("ignores a budget that jitters by less than half a line", () => {
    // The loop guard: repacking re-renders, which measures again. A scrollbar
    // or a sub-pixel line height must not start that cycle.
    expect(fitChangedMeaningfully(fit(), fit({ budgetPx: 610 }))).toBe(false);
  });

  it("accepts a budget that moves by more than half a line", () => {
    expect(fitChangedMeaningfully(fit(), fit({ budgetPx: 640 }))).toBe(true);
  });

  it("accepts the slide picture appearing or disappearing", () => {
    // The change this whole file exists for is far past any threshold.
    expect(fitChangedMeaningfully(WITHOUT_PICTURE, WITH_PICTURE)).toBe(true);
  });
});

describe("the deck measures every screen and shows the slide on each", () => {
  const deck = readFileSync(
    "src/components/willab/TranscriptReviewDeck.tsx",
    "utf8",
  );

  it("no longer measures only the screen that happens to be active", () => {
    // `innerRefs.current[posRef.current.slide]` was the single read that made
    // the budget depend on where the reader was standing.
    expect(deck).not.toMatch(
      /innerRefs\.current\[posRef\.current\.slide\]/,
    );
    expect(deck).toMatch(/tightestFit\(/);
    expect(deck).toMatch(/innerRefs\.current\.map\(/);
  });

  it("draws the slide on continuation screens too", () => {
    // Founder: "it should just repeat the slide and render the rest of the
    // text there". The gate below is also what made the two screen kinds
    // different heights in the first place.
    expect(deck).not.toMatch(/g\.screenOfSlide === 0 &&\s*presentationRef/);
    expect(deck).toMatch(/\{presentationRef && g\.slideIndex !== null \?/);
  });
});
