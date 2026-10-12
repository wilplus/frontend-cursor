import { describe, expect, it } from "vitest";
import {
  mapRecordingBand,
  mapTokenBalance,
  mapArcCharges,
  mapTokenPrices,
  priceForArcAction,
} from "./tokens";

describe("the flag-off probe", () => {

  it("treats a missing or malformed envelope as off, never as enabled", () => {
    for (const raw of [null, undefined, {}, "nope", { enabled: "true" }]) {
      expect(mapTokenBalance(raw).kind).toBe("off");
      expect(mapTokenPrices(raw)).toBeNull();
    }
  });
});

describe("mapTokenBalance", () => {

  it("reads available:false as UNKNOWN, never as zero", () => {
    // The distinction the whole module turns on: showing zero for a failed
    // lookup would hide the record button over a bad read.
    const b = mapTokenBalance({ enabled: true, available: false, balance: 41500 });
    expect(b.kind).toBe("unknown");
  });
});

describe("mapRecordingBand", () => {

  it("reports can_record:false as EXHAUSTED, keeping the renewal date", () => {
    // "exhausted", not "blocked": the renewal date is what makes waiting a
    // visible option, and the caller is required to leave recording enabled
    // because takes charge after transcription and fail open.
    expect(
      mapRecordingBand({
        enabled: true,
        can_record: false,
        balance: 200,
        period_ends_at: "2026-08-28T09:00:00+00:00",
      })
    ).toEqual({
      kind: "exhausted",
      balance: 200,
      periodEndsAt: "2026-08-28T09:00:00+00:00",
    });
  });
});

describe("mapArcCharges / priceForArcAction", () => {
  const PAYLOAD = {
    enabled: true,
    arc_id: "arc_1",
    charged: { insights: true, moment_explanation: false },
    prices: { insights: 1000, moment_explanation: 2500 },
  };

  it("shows nothing when the charge state is unknown, never assuming unpaid", () => {
    // Assuming "not yet charged" is exactly what produces a wrong label.
    expect(priceForArcAction(mapArcCharges(PAYLOAD), "coach_review")).toBeNull();
    expect(priceForArcAction({ kind: "unknown" }, "moment_explanation")).toBeNull();
    expect(priceForArcAction({ kind: "off" }, "moment_explanation")).toBeNull();
  });
});
