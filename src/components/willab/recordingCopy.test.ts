/*
STORY    As the founder, I want the recording screens' words fixed to the
         signed set with no digits or score words, so that nothing unapproved
         or numeric reaches the speaker.
OUTCOME
  O1  Never 4 (no new words without the founder's OK): RECORDING_COPY holds
      exactly the signed keys, typed exactly as signed.
  O2  Never 1 (no scores or numbers): no signed line carries a digit, a % or
      a score word.
PROVES   O1, O2 -> "is exactly the signed words, with no digit or score word"
WHY      Recording lock 2026-10-07 (N59, N70). recordingWhere's "Take N ·
         Slide n of m" is pinned in recordingStillFrame.test, not here.
*/
import { describe, expect, it } from "vitest";
import { RECORDING_COPY } from "./recordingCopy";

describe("RECORDING_COPY", () => {
  it("is exactly the signed words, with no digit or score word", () => {
    expect(RECORDING_COPY).toEqual({
      back: "Back",
      nextSlide: "Next slide",
      micReady: "Getting your mic ready",
    });
    for (const [key, value] of Object.entries(RECORDING_COPY)) {
      expect(value, key).not.toMatch(/\d|%|score|rank/i);
    }
  });
});
