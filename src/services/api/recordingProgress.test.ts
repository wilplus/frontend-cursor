import { describe, expect, it } from "vitest";
import {
  mapRecordingProgress,
} from "./recordingProgress";

describe("mapRecordingProgress (C-2 / S2)", () => {

  it("returns null on a missing / non-positive threshold or missing total", () => {
    expect(mapRecordingProgress({ recorded_seconds: 120 })).toBeNull();
    expect(
      mapRecordingProgress({ recorded_seconds: 120, threshold_seconds: 0 })
    ).toBeNull();
    expect(mapRecordingProgress({ threshold_seconds: 600 })).toBeNull();
    expect(mapRecordingProgress(null)).toBeNull();
  });
});
