import { describe, expect, it } from "vitest";
import {
  mapRecordingProgress,
  audioRemainingLabel,
  progressFraction,
} from "./recordingProgress";

describe("mapRecordingProgress (C-2 / S2)", () => {
  it("maps snake → camel and derives unlocked when omitted", () => {
    expect(
      mapRecordingProgress({ recorded_seconds: 120, threshold_seconds: 600 })
    ).toEqual({ recordedSeconds: 120, thresholdSeconds: 600, unlocked: false });
    expect(
      mapRecordingProgress({ recorded_seconds: 700, threshold_seconds: 600 })
    ).toEqual({ recordedSeconds: 700, thresholdSeconds: 600, unlocked: true });
  });

  it("honours an explicit unlocked flag over the derived one", () => {
    expect(
      mapRecordingProgress({
        recorded_seconds: 100,
        threshold_seconds: 600,
        unlocked: true,
      })?.unlocked
    ).toBe(true);
  });

  it("clamps negative recorded to 0", () => {
    expect(
      mapRecordingProgress({ recorded_seconds: -5, threshold_seconds: 600 })
        ?.recordedSeconds
    ).toBe(0);
  });

  it("returns null on a missing / non-positive threshold or missing total", () => {
    expect(mapRecordingProgress({ recorded_seconds: 120 })).toBeNull();
    expect(
      mapRecordingProgress({ recorded_seconds: 120, threshold_seconds: 0 })
    ).toBeNull();
    expect(mapRecordingProgress({ threshold_seconds: 600 })).toBeNull();
    expect(mapRecordingProgress(null)).toBeNull();
  });
});

describe("audioRemainingLabel (C-2)", () => {
  it("formats remaining seconds as M:SS", () => {
    expect(
      audioRemainingLabel({
        recordedSeconds: 73,
        thresholdSeconds: 600,
        unlocked: false,
      })
    ).toBe("8:47"); // 527s remaining
  });

  it("pads the seconds", () => {
    expect(
      audioRemainingLabel({
        recordedSeconds: 595,
        thresholdSeconds: 600,
        unlocked: false,
      })
    ).toBe("0:05");
  });

  it("returns null once unlocked or nothing remains", () => {
    expect(
      audioRemainingLabel({
        recordedSeconds: 600,
        thresholdSeconds: 600,
        unlocked: true,
      })
    ).toBeNull();
    expect(
      audioRemainingLabel({
        recordedSeconds: 600,
        thresholdSeconds: 600,
        unlocked: false,
      })
    ).toBeNull();
  });
});

describe("progressFraction (C-2)", () => {
  it("clamps to [0,1]", () => {
    expect(
      progressFraction({
        recordedSeconds: 300,
        thresholdSeconds: 600,
        unlocked: false,
      })
    ).toBe(0.5);
    expect(
      progressFraction({
        recordedSeconds: 900,
        thresholdSeconds: 600,
        unlocked: true,
      })
    ).toBe(1);
  });
});
