import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  forgetPlaces,
  placeFromScroll,
  rememberPlace,
  rememberedPlace,
} from "./waitingTipsDeck";
import { availableWaitingTips } from "./processingWaitingTips";
import { WAITING_TIPS, pickWaitingTip } from "./waitingTips";

describe("waitingTips", () => {
  it("always returns one of the approved tips", () => {
    for (let i = 0; i < 50; i++) {
      expect(WAITING_TIPS).toContain(pickWaitingTip());
    }
  });

  it("can return more than one distinct tip across sessions", () => {
    // One tip per waiting session, but not the SAME one every session.
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pickWaitingTip());
    expect(seen.size).toBeGreaterThan(1);
  });

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
    expect(READOUT).toMatch(/onNewTake=\{onReRead\}/);
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

describe("the reader keeps their place across a remount", () => {
  /* One wait remounts this screen: the analysis phase hands over to the
     document phase, and an overlay can close and reopen. Starting again at the
     first tip would take someone back to the top of something they were
     halfway through — what waitingTips.ts calls for: "the exact scroll
     position survives every processing screen". */
  beforeEach(() => forgetPlaces());

  it("starts at the first tip when the job has not been seen", () => {
    expect(rememberedPlace(1_000, 12)).toBe(0);
  });

  it("gives back exactly where that job got to", () => {
    rememberPlace(1_000, 5);
    expect(rememberedPlace(1_000, 12)).toBe(5);
  });

  it("keeps jobs apart", () => {
    rememberPlace(1_000, 5);
    expect(rememberedPlace(2_000, 12)).toBe(0);
  });

  it("clamps a place the collection can no longer hold", () => {
    // The collection is filtered at runtime (version skew, malformed entries),
    // so a remembered index can outlive the tip it pointed at.
    rememberPlace(1_000, 11);
    expect(rememberedPlace(1_000, 4)).toBe(3);
    expect(rememberedPlace(1_000, 1)).toBe(0);
  });

  it("does not grow without bound in a long-lived tab", () => {
    for (let job = 0; job < 20; job += 1) rememberPlace(job, 1);
    // The oldest are dropped; the most recent are still answerable.
    expect(rememberedPlace(19, 12)).toBe(1);
    expect(rememberedPlace(0, 12)).toBe(0);
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
