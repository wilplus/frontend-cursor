/*
STORY    As a speaker, I want a failed balance check shown as "unknown" (not
         zero), "out of tokens" to keep its renewal date and leave recording
         on, and no price shown when the charge state is unknown, so that I'm
         never wrongly blocked or charged.
OUTCOME
  O1  A missing or broken answer means tokens are off, never on.
  O2  A balance the server couldn't read is "unknown", not zero.
  O3  "Out of tokens" keeps the renewal date.
  O4  No price label is shown when it isn't known whether I was charged.
PROVES   O1 -> "treats a missing or malformed envelope as off, never as enabled"
         O2 -> "reads available:false as UNKNOWN, never as zero"
         O3 -> "reports can_record:false as EXHAUSTED, keeping the renewal date"
         O4 -> "shows nothing when the charge state is unknown, never assuming unpaid"
WHY      Never-rule 3: a bad balance read must never hide the record button.
*/
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
