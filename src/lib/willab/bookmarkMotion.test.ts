import { describe, expect, it } from "vitest";
import {
  type BookmarkTier,
  markPulses,
  marksMove,
  motionClasses,
} from "./bookmarkMotion";

/* -------------------------------------------------------------------------- */
/*  ONLY THE EXERCISE MOVES (founder 2026-09-20)                               */
/*                                                                            */
/*  Two rulings on the first bookmarks the product ever showed.                */
/*                                                                            */
/*  "two green bookmarks pulsing and one orange also pulsing. It should not be */
/*  pulsing."  The mark carried two animations and only `animate-pulse` was    */
/*  gated; the attention ring's `animate-lock-breathe` ran on every undecided  */
/*  mark, so all three moved.                                                  */
/*                                                                            */
/*  "the ring should not be there because the role of solid bookmark is taken  */
/*  by just black text. There is just fill and motion."  The ring went, and    */
/*  its animation with it — `lock-breathe` WAS the ring breathing.             */
/*                                                                            */
/*  What these tests hold is the end state: one device per fact, and motion    */
/*  belonging to exactly one tier.                                             */
/* -------------------------------------------------------------------------- */

const TIERS: BookmarkTier[] = [
  "exercise",
  "most_confident",
  "standard",
  null,
];

describe("motionClasses", () => {
  it("moves the exercise, and nothing else", () => {
    // The whole point. The exercise is the one item the speaker is asked to
    // go and do (24f); a moment that congratulates itself in motion is asking
    // for attention it has not earned.
    expect(motionClasses("exercise")).toBe("motion-safe:animate-pulse");
    for (const tier of TIERS.filter((t) => t !== "exercise")) {
      expect(motionClasses(tier)).toBe("");
    }
  });

  it("leaves NO trace of the ring's breathing anywhere", () => {
    // `lock-breathe` scaled the attention ring 1 → 1.1 → 1, every two
    // seconds, forever. The ring is gone, so a ring animation is a class
    // animating nothing. Its return would be the old bug wearing the old
    // name.
    for (const tier of TIERS) {
      expect(motionClasses(tier)).not.toContain("lock-breathe");
    }
  });

  it("is motion-safe, so Reduce Motion stops everything", () => {
    expect(motionClasses("exercise")).toMatch(/^motion-safe:/);
  });

  it("emits classes, never undefined or a stray space", () => {
    for (const tier of TIERS) {
      const out = motionClasses(tier);
      expect(typeof out).toBe("string");
      expect(out).toBe(out.trim());
    }
  });
});

describe("markPulses", () => {
  it("is the exercise alone", () => {
    expect(markPulses("exercise")).toBe(true);
    expect(markPulses("most_confident")).toBe(false);
    expect(markPulses("standard")).toBe(false);
    expect(markPulses(null)).toBe(false);
  });
});

describe("marksMove — the founder's sentence, asserted directly", () => {
  it("green does NOT move", () => {
    // Said in a comment for weeks while the screen did the opposite. Now it
    // is a test.
    expect(marksMove("most_confident")).toBe(false);
  });

  it("an ordinary orange mark does NOT move", () => {
    expect(marksMove("standard")).toBe(false);
  });

  it("an untiered mark does NOT move", () => {
    // It used to, via the ring. With the ring gone there is nothing for it
    // to breathe around, so stillness is the honest default.
    expect(marksMove(null)).toBe(false);
  });

  it("the exercise moves", () => {
    expect(marksMove("exercise")).toBe(true);
  });

  it("exactly one tier moves, so motion still means one thing", () => {
    expect(TIERS.filter((tier) => marksMove(tier))).toEqual(["exercise"]);
  });
});
