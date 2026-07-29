import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchRecordingConfig,
  mapRecordingConfig,
  resetRecordingConfigCache,
} from "./recordingConfig";

/* -------------------------------------------------------------------------- */
/*  FE-5 — the caution threshold is SERVED, never hardcoded. 600 is today's    */
/*  value; the point of serving it is that it can move without a deploy, so    */
/*  the mapper must carry whatever arrives and refuse to invent a default.     */
/* -------------------------------------------------------------------------- */

describe("mapRecordingConfig", () => {
  it("carries the served threshold", () => {
    expect(mapRecordingConfig({ long_take_caution_sec: 600 })).toEqual({
      longTakeCautionSec: 600,
    });
    // A moved threshold is carried as-is — no clamping toward 600.
    expect(mapRecordingConfig({ long_take_caution_sec: 420 })).toEqual({
      longTakeCautionSec: 420,
    });
  });

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

describe("fetchRecordingConfig", () => {
  beforeEach(() => {
    resetRecordingConfigCache();
    vi.resetModules();
  });

  it("resolves to no threshold when the endpoint is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    // The auth token read is what gates the call; without a session there is
    // nothing to ask and the caution simply does not fire.
    const config = await fetchRecordingConfig();
    expect(config.longTakeCautionSec).toBeNull();
    vi.unstubAllGlobals();
  });
});
