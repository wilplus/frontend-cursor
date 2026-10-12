import { describe, expect, it } from "vitest";
import {
  mapRecordingProgress,
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
