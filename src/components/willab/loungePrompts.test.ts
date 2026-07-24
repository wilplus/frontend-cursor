import { describe, expect, it } from "vitest";
import { coerceSuggestedAction, CHIP_LABEL } from "./loungePrompts";

describe("coerceSuggestedAction (B-1 / S1)", () => {
  it("passes through the known actions", () => {
    expect(coerceSuggestedAction("trainings")).toBe("trainings");
    expect(coerceSuggestedAction("audit")).toBe("audit");
  });

  it("returns null for absent / null / unknown (graceful degradation)", () => {
    expect(coerceSuggestedAction(undefined)).toBeNull();
    expect(coerceSuggestedAction(null)).toBeNull();
    expect(coerceSuggestedAction("")).toBeNull();
    expect(coerceSuggestedAction("explore")).toBeNull();
    expect(coerceSuggestedAction(42)).toBeNull();
    expect(coerceSuggestedAction({ action: "trainings" })).toBeNull();
  });

  it("removed / never-chip actions coerce to null", () => {
    // record_again: the bot points at the official record button in words.
    expect(coerceSuggestedAction("record_again")).toBeNull();
    // strong_sides: the surface was removed in R4-13 — an old persisted
    // suggestion must degrade to no button, not crash.
    expect(coerceSuggestedAction("strong_sides")).toBeNull();
    // arc_checkout: retired with the $25/arc paywall (only $5 moments is paid);
    // an old pay-note bubble must degrade to no button.
    expect(coerceSuggestedAction("arc_checkout")).toBeNull();
  });

  it("every action has a label", () => {
    for (const a of ["trainings", "audit"] as const) {
      expect(CHIP_LABEL[a]).toBeTruthy();
    }
  });
});
