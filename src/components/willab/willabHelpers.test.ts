/*
STORY    As a speaker, I want my slide taps lined up with the recording's clock, so that each word lands on the right slide.
OUTCOME
  O1  When the recording started later than the tap clock, the correction is positive by exactly that gap.
  O2  When the recording never reported a start, no correction is sent.
PROVES   O1 -> is positive when the recorder started after the tap clock's zero
         O2 -> sends nothing when the recorder never reported a start
WHY      The backend subtracts this from every tap; the wrong sign would double the drift.
*/
import { describe, expect, it } from "vitest";
import {
  measureSlideClockOffset,
} from "./willabHelpers";

describe("measureSlideClockOffset", () => {
  // The contract: offset = t_recorderFirstAudio - t_zeroUsedForTapTimes, and
  // the backend SUBTRACTS it from every tap. Getting the sign backwards would
  // double the drift instead of removing it, so pin it explicitly.
  it("is positive when the recorder started after the tap clock's zero", () => {
    // UI zero at 1000, audio actually began at 1120 => taps run 120ms ahead.
    expect(measureSlideClockOffset(1120, 1000)).toBe(120);
  });

  it("sends nothing when the recorder never reported a start", () => {
    expect(measureSlideClockOffset(null, 1000)).toBeUndefined();
  });
});
