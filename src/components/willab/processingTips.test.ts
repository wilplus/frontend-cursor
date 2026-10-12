import { beforeEach, describe, expect, it } from "vitest";
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
