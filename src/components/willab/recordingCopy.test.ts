/* -------------------------------------------------------------------------- */
/*  THE RECORDING SCREENS' WORDS AND NUMBERS, PINNED (build plan D-RC-8;       */
/*  recording lock 2026-10-07 §The words and §How it moves, N59).              */
/*                                                                            */
/*  RECORDING_COPY holds the lock's words exactly as signed; recordingWhere   */
/*  writes "Take N · Slide n of m" with the Take's and the slide's position   */
/*  as the only numbers (AC-9). The gesture constants are the lock's: a       */
/*  change to any of them is a change to the locked motion, and this test     */
/*  (and e2e/recording-screens.spec.mjs, which reads the same constants)      */
/*  fails on it.                                                              */
/* -------------------------------------------------------------------------- */
import { describe, expect, it } from "vitest";
import { RECORDING_COPY, recordingWhere } from "./recordingCopy";
import {
  ENTER_OFFSET_PX,
  GLIDE_OUT_MS,
  LAND_EASE,
  LAND_MS,
  MOMENTUM_MS,
  TOUCH_COMMIT_PX,
  WHEEL_COMMIT,
  WHEEL_REST_MS,
  WHEEL_SOFT,
} from "@/lib/willab/recordingGesture";

describe("RECORDING_COPY", () => {
  it("holds the lock's words, word for word", () => {
    expect(RECORDING_COPY).toMatchObject({
      scrollToStart: "Scroll down to start",
      clickToStart: "Click down to start",
    });
  });

  it("carries no digit (AC-9) and nothing unsigned", () => {
    for (const [key, value] of Object.entries(RECORDING_COPY)) {
      expect(value, key).not.toMatch(/\d/);
      expect(value, key).not.toMatch(/%|score|rank/i);
    }
    // Every key is one the lock names; a new word needs the founder first.
    expect(Object.keys(RECORDING_COPY).sort()).toEqual(
      expect.arrayContaining(["clickToStart", "scrollToStart"]),
    );
    for (const key of Object.keys(RECORDING_COPY)) {
      expect(["scrollToStart", "clickToStart", "micReady"]).toContain(key);
    }
  });
});

describe("recordingWhere", () => {
  it('reads "Take N · Slide n of m" with the Take and the position as its only numbers', () => {
    expect(recordingWhere(2, 1, 3)).toBe("Take 2 · Slide 2 of 3");
    expect(recordingWhere(1, 0, 6)).toBe("Take 1 · Slide 1 of 6");
  });

  it("reads the slide alone when there is no Take (the /dev harness)", () => {
    expect(recordingWhere(null, 2, 3)).toBe("Slide 3 of 3");
    expect(recordingWhere(0, 0, 1)).toBe("Slide 1 of 1");
  });

  it('never says "Recording"', () => {
    expect(recordingWhere(2, 0, 3)).not.toMatch(/recording/i);
  });
});

describe("the gesture constants are the lock's (§How it moves)", () => {
  it("touch: a slide moves after 90px of travel", () => {
    expect(TOUCH_COMMIT_PX).toBe(90);
  });

  it("wheel: 140 at once, or 90 after a 220ms rest; the momentum tail ignored for 450ms", () => {
    expect(WHEEL_COMMIT).toBe(140);
    expect(WHEEL_SOFT).toBe(90);
    expect(WHEEL_REST_MS).toBe(220);
    expect(MOMENTUM_MS).toBe(450);
  });

  it("the landing: out in 200ms, in over 420ms on cubic-bezier(.16,1,.3,1)", () => {
    expect(GLIDE_OUT_MS).toBe(200);
    expect(LAND_MS).toBe(420);
    expect(LAND_EASE).toBe("cubic-bezier(.16,1,.3,1)");
    expect(ENTER_OFFSET_PX).toBe(24);
  });
});
