/*
STORY    As the founder, I want the "this Take is getting long" warning
         threshold to come only from the server, so that I can change it
         without a deploy and the app never invents one.
OUTCOME
  O1  A missing or unusable threshold gives no threshold, never a made-up
      default.
PROVES   O1 -> "never substitutes a default when the field is missing or unusable"
*/
import { describe, expect, it } from "vitest";
import {
  mapRecordingConfig,
} from "./recordingConfig";

describe("mapRecordingConfig", () => {

  it("never substitutes a default when the field is missing or unusable", () => {
    for (const raw of [
      {},
      { long_take_caution_sec: null },
      { long_take_caution_sec: "600" },
      { long_take_caution_sec: 0 },
      { long_take_caution_sec: -1 },
      { long_take_caution_sec: Number.NaN },
      null,
    ]) {
      expect(mapRecordingConfig(raw).longTakeCautionSec).toBeNull();
    }
  });
});
