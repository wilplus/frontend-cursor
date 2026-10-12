import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  forgetPlaces,
  openingPlace,
  placeFromScroll,
  rememberPlace,
} from "./waitingTipsDeck";
import { availableWaitingTips } from "./processingWaitingTips";
import { WAITING_TIPS } from "./waitingTips";

describe("waitingTips", () => {

  it("carries no em-dashes (product copy rule)", () => {
    for (const tip of WAITING_TIPS) expect(tip).not.toContain("—");
  });

  it("keeps every tip short enough to read during a wait", () => {
    for (const tip of WAITING_TIPS) expect(tip.length).toBeLessThan(200);
  });
});

/* -------------------------------------------------------------------------- */
/*  ONE WAITING SCREEN, AND NOTHING ON IT (founder 2026-08-12: "that surface   */
/*  is not necessary; it is the old button surfacing — please clear it so that */
/*  there is only one waiting screen without anything like that").             */
/*                                                                            */
/*  This screen keeps growing things back. It has already been a second        */
/*  "Working on your text" variant (deleted), and then a "Record the next      */
/*  take" button (deleted here). Both were added to route around the SAME      */
/*  underlying defect — the stale mic that bounced every re-entry into         */
/*  lab_recording back onto the waiting screen. That is fixed at the source    */
/*  now, so an extra door beside the working one is just the old surface       */
/*  showing through.                                                          */
/* -------------------------------------------------------------------------- */

/** Source with comments stripped — the file explains at length which
 *  treatments were retired, and scanning raw text would fail on the record of
 *  the decision rather than on a breach of it. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

describe("the waiting screen carries nothing but the wait", () => {
  const READOUT = code("src/components/willab/IdealTextReadout.tsx");
  /** The `analysisPending` early return — assertions about "the waiting
   *  screen" must not accidentally pass on the normal readout below it,
   *  which legitimately carries the record affordance. */
  const BLOCK = READOUT.slice(
    READOUT.indexOf("if (analysisPending) {"),
    READOUT.indexOf("if (analysisPending) {") +
      READOUT.slice(READOUT.indexOf("if (analysisPending) {")).indexOf("\n  }\n")
  );

  it("shows ProcessingWait and no second affordance", () => {
    expect(BLOCK).toMatch(/<ProcessingWait\b/);
    expect(BLOCK).not.toMatch(/Record the next take/);
    expect(BLOCK).not.toMatch(/onReRead/);
    expect(BLOCK).not.toMatch(/<Mic/);
  });

  it("keeps the way OUT — the block is on the text, not on leaving", () => {
    // SPEC-lockin-loop §1: while the document assembles the old text is
    // inaccessible, "no browse-with-banner". Closing was never part of that.
    expect(BLOCK).toMatch(/OverlayCloseButton/);
  });

  it("the record affordance still exists on the READOUT itself", () => {
    // Removing it from the wait must not remove it from the screen that is
    // supposed to have it — otherwise the next take has no door at all. The
    // readout does not own the label: it hands `onReRead` to IdealTextActions
    // (which carries the founder's "Record the next take"), and falls back to
    // its own small mic when there is no master-document payload.
    // Phase 0.6: a guest's Record Take 2 asks to sign up first; the
    // affordance itself is the same button for everyone.
    expect(READOUT).toMatch(/onNewTake=\{gate\(onReRead, undefined\)\}/);
    expect(code("src/components/willab/IdealTextActions.tsx"))
      .toMatch(/Record the next take/);
  });
});

describe("the advice does not move on its own", () => {
  /* REPLACED 2026-09-23 (founder: "we want them to be static with a scroll...
     so that you can scroll as you wait, from one advice to another").

     Two tests lived here and both asserted the crossfade: that the same job
     epoch derived the same frame after a remount, and that the cycle swapped
     every seven seconds. They exercised `processingTipFrame` directly, so they
     kept passing after the component stopped calling it — guarding a behaviour
     that no longer ships while nothing guarded the one that does. That is the
     failure mode worth naming: a pure-module test outlives the decision that
     made the module worth having. */
  const source = code("src/components/willab/RecordingAnalysisPresentation.tsx");

  it("runs no timer on the tips", () => {
    expect(source).not.toContain("processingTipFrame");
    expect(source).not.toMatch(/setTimeout|setInterval/);
  });

  it("renders every tip rather than one at a time", () => {
    // The whole collection is in the DOM and the reader moves through it.
    expect(source).toContain("waitingTips.map");
    expect(source).toContain("snap-y");
    expect(source).toContain("snap-mandatory");
  });

  it("moves one tip per gesture, by the Ideal Text deck's own machine", () => {
    // "The same scroll like you have on the ideal text" — the same code, so
    // there is one place to fix if the feel is ever wrong again.
    expect(source).toContain("wheelGestureStep");
  });

  it("drops the live region the rotation needed", () => {
    // It announced text that changed unasked. Announcing a tip the reader
    // scrolled to deliberately would talk over them.
    expect(source).not.toContain("aria-live");
  });
});

describe("each wait opens somewhere new", () => {
  /* Founder 2026-09-23: "it should start randomly with different advices, but
     then you can scroll through it." Making the advice static fixed the
     reading problem and created a smaller one — a person who never scrolls
     would meet the same first advice on every take forever. */
  beforeEach(() => forgetPlaces());

  it("opens on the advice the roll chose", () => {
    expect(openingPlace(1_000, 12, () => 0.5)).toBe(6);
    forgetPlaces();
    expect(openingPlace(1_000, 12, () => 0)).toBe(0);
  });

  it("never lands past the end on a roll of almost one", () => {
    expect(openingPlace(1_000, 12, () => 0.999_999)).toBe(11);
  });

  it("ROLLS ONCE PER JOB, so a remount cannot shuffle it", () => {
    // The whole trick. A roll on every render would move the advice under
    // someone mid-sentence — the carousel again, only unpredictable.
    const first = openingPlace(1_000, 12, () => 0.25);
    expect(openingPlace(1_000, 12, () => 0.9)).toBe(first);
    expect(openingPlace(1_000, 12, () => 0.1)).toBe(first);
  });

  it("does not re-roll over a place the reader scrolled to", () => {
    openingPlace(1_000, 12, () => 0.25);
    rememberPlace(1_000, 9);
    expect(openingPlace(1_000, 12, () => 0.8)).toBe(9);
  });

  it("rolls separately for a different job", () => {
    expect(openingPlace(1_000, 12, () => 0.25)).toBe(3);
    expect(openingPlace(2_000, 12, () => 0.75)).toBe(9);
  });

  it("survives a collection of one, and of none", () => {
    expect(openingPlace(1_000, 1, () => 0.9)).toBe(0);
    forgetPlaces();
    expect(openingPlace(1_000, 0, () => 0.9)).toBe(0);
  });

  it("spreads across the collection rather than favouring one end", () => {
    // Not a distribution proof — just that the mapping uses the whole range,
    // which a stray Math.floor or an off-by-one would break.
    const seen = new Set<number>();
    for (let roll = 0; roll < 12; roll += 1) {
      forgetPlaces();
      seen.add(openingPlace(1_000, 12, () => roll / 12));
    }
    expect(seen.size).toBe(12);
  });
});

describe("which tip a scroll position is showing", () => {
  it("reports the nearest panel, not the one being left", () => {
    // Half a drag past the boundary is already the next tip as far as the
    // browser's snap is concerned, so the dots must agree.
    expect(placeFromScroll(0, 200, 12)).toBe(0);
    expect(placeFromScroll(99, 200, 12)).toBe(0);
    expect(placeFromScroll(100, 200, 12)).toBe(1);
    expect(placeFromScroll(420, 200, 12)).toBe(2);
  });

  it("never reports past the end, or a NaN height", () => {
    expect(placeFromScroll(99_999, 200, 12)).toBe(11);
    expect(placeFromScroll(100, 0, 12)).toBe(0);
    expect(placeFromScroll(100, Number.NaN, 12)).toBe(0);
  });
});

describe("ProcessingWait across a live deployment", () => {
  it("falls back when the older waitingTips module has no collection", () => {
    const tips = availableWaitingTips(undefined);

    expect(tips).toHaveLength(1);
    expect(tips[0]).toContain("Focus on the value your audience needs");
    expect(() => tips.map((tip) => tip.length)).not.toThrow();
  });

  it("keeps the approved collection when the current module is loaded", () => {
    expect(availableWaitingTips(["First", "Second"])).toEqual([
      "First",
      "Second",
    ]);
  });

  it("removes malformed entries before rendering", () => {
    expect(availableWaitingTips(["Good", undefined, "", 4])).toEqual([
      "Good",
    ]);
  });
});
