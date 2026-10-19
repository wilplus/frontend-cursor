/*
STORY    As a speaker, I want recording progress shown only when the server
         gives a real threshold and total, so that I never see a made-up
         progress figure.
OUTCOME
  O1  A missing, zero or null threshold or total gives null (nothing shown).
  O2  A real total and threshold map through, with the server's unlock flag
      or, when it is missing, unlocked once the total reaches the threshold.
PROVES   O1 -> "returns null on a missing / non-positive threshold or missing total"
         O2 -> "maps the server's total and threshold"
WHY      C-2 / S2: the total is the backend's; the browser never sums it.
*/
import { describe, expect, it } from "vitest";
import { mapRecordingProgress } from "./recordingProgress";

describe("mapRecordingProgress (C-2 / S2)", () => {

  it("returns null on a missing / non-positive threshold or missing total", () => {
    expect(mapRecordingProgress({ recorded_seconds: 120 })).toBeNull();
    expect(
      mapRecordingProgress({ recorded_seconds: 120, threshold_seconds: 0 })
    ).toBeNull();
    expect(mapRecordingProgress({ threshold_seconds: 600 })).toBeNull();
    expect(mapRecordingProgress(null)).toBeNull();
  });

  it("maps the server's total and threshold", () => {
    expect(
      mapRecordingProgress({ recorded_seconds: 120, threshold_seconds: 600, unlocked: false })
    ).toEqual({ recordedSeconds: 120, thresholdSeconds: 600, unlocked: false });
    expect(
      mapRecordingProgress({ recorded_seconds: 600, threshold_seconds: 600 })
    ).toEqual({ recordedSeconds: 600, thresholdSeconds: 600, unlocked: true });
  });
});
