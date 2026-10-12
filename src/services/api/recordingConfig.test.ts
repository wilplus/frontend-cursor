import { describe, expect, it } from "vitest";
import {
  mapRecordingConfig,
} from "./recordingConfig";

/* -------------------------------------------------------------------------- */
/*  FE-5 — the caution threshold is SERVED, never hardcoded. 600 is today's    */
/*  value; the point of serving it is that it can move without a deploy, so    */
/*  the mapper must carry whatever arrives and refuse to invent a default.     */
/* -------------------------------------------------------------------------- */

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
