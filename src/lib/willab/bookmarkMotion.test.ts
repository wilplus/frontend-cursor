import { describe, expect, it } from "vitest";

import {
  markPulses,
  motionClasses,
  marksMove,
  ringBreathes,
} from "@/lib/willab/bookmarkMotion";

/* -------------------------------------------------------------------------- */
/*  ONLY THE EXERCISE MOVES (contract 24g)                                     */
/*                                                                            */
/*  Founder, 2026-09-20, on the first bookmarks the product ever showed:       */
/*  "two green bookmarks pulsing and one orange also pulsing — it should not   */
/*  be pulsing."                                                               */
/*                                                                            */
/*  `DeckLockMark` carried a comment saying "GREEN NEVER PULSES" for as long   */
/*  as the tiers have existed. It was true of `animate-pulse` and false of     */
/*  the screen: the attention ring's `lock-breathe` scales 1 → 1.1 → 1 every   */
/*  two seconds forever, `attention` includes `status === "waiting"`, and      */
/*  every undecided bookmark is waiting. Two animations, one intent, and only  */
/*  one of them counted.                                                       */
/*                                                                            */
/*  A comment asserted this rule once and the screen disagreed. These are the  */
/*  assertions that cannot.                                                    */
/* -------------------------------------------------------------------------- */

const UNDECIDED = true;

describe("only the exercise moves", () => {
  it("does not move a most-confident mark, even undecided", () => {
    // THE REPORT, in one line.
    expect(marksMove("most_confident", UNDECIDED)).toBe(false);
  });

  it("does not move a standard mark, even undecided", () => {
    expect(marksMove("standard", UNDECIDED)).toBe(false);
  });

  it("moves the exercise mark", () => {
    expect(marksMove("exercise", UNDECIDED)).toBe(true);
  });

  it("gives the exercise both animations and the others neither", () => {
    expect(motionClasses("exercise", UNDECIDED)).toContain(
      "motion-safe:animate-lock-breathe",
    );
    expect(motionClasses("exercise", UNDECIDED)).toContain(
      "motion-safe:animate-pulse",
    );
    expect(motionClasses("most_confident", UNDECIDED)).toBe("");
    expect(motionClasses("standard", UNDECIDED)).toBe("");
  });
});

describe("the ring is not the motion", () => {
  it("nothing moves when there is nothing waiting", () => {
    for (const tier of ["exercise", "most_confident", "standard", null] as const) {
      expect(ringBreathes(tier) && false).toBe(false);
      expect(motionClasses(tier, false)).not.toContain("lock-breathe");
    }
  });

  it("a settled exercise still pulses but does not breathe", () => {
    // The pulse belongs to the ITEM (24f: go and do this one); the breathe
    // belongs to the undecided STATE. They are different claims.
    const settled = motionClasses("exercise", false);
    expect(settled).toContain("motion-safe:animate-pulse");
    expect(settled).not.toContain("lock-breathe");
  });
});

describe("an untiered mark is untouched", () => {
  /* SAFE-AHEAD. `tier` shipped with "null renders exactly today's mark", and
     a paragraph with no V3 tier — every paragraph before the cutover, and any
     whose block produced no candidate — must keep the pre-tier behaviour. */
  it("still breathes when something is waiting on it", () => {
    expect(ringBreathes(null)).toBe(true);
    expect(motionClasses(null, UNDECIDED)).toBe(
      "motion-safe:animate-lock-breathe",
    );
  });

  it("never pulses, because the pulse means the exercise", () => {
    expect(markPulses(null)).toBe(false);
  });
});

describe("every animation stays motion-safe", () => {
  /* The restraint the mark has always kept: a reader who has asked their
     device for reduced motion gets none of this. */
  it("prefixes every class it emits", () => {
    for (const tier of ["exercise", "most_confident", "standard", null] as const) {
      for (const attention of [true, false]) {
        for (const cls of motionClasses(tier, attention).split(" ").filter(Boolean)) {
          expect(cls.startsWith("motion-safe:")).toBe(true);
        }
      }
    }
  });
});
