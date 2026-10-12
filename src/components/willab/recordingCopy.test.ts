/* -------------------------------------------------------------------------- */
/*  THE RECORDING SCREENS' WORDS AND NUMBERS, PINNED (build plan D-RC-8;       */
/*  recording lock 2026-10-07 §The words and §How it moves, N59; N70).         */
/*                                                                            */
/*  RECORDING_COPY holds the lock's words exactly as signed; recordingWhere   */
/*  writes "Take N · Slide n of m" with the Take's and the slide's position   */
/*  as the only numbers (AC-9). The motion constants are the lock's: a        */
/*  change to any of them is a change to the locked motion, and this test     */
/*  fails on it.                                                              */
/* -------------------------------------------------------------------------- */
import { describe, expect, it } from "vitest";
import { RECORDING_COPY } from "./recordingCopy";

describe("RECORDING_COPY", () => {

  it("carries no digit (AC-9) and nothing unsigned", () => {
    for (const [key, value] of Object.entries(RECORDING_COPY)) {
      expect(value, key).not.toMatch(/\d/);
      expect(value, key).not.toMatch(/%|score|rank/i);
    }
    // Every key is one the lock names; a new word needs the founder first.
    expect(Object.keys(RECORDING_COPY).sort()).toEqual(["back", "micReady", "nextSlide"]);
  });
});

