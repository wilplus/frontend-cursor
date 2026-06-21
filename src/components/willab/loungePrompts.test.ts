import { describe, expect, it } from "vitest";
import { coerceSuggestedAction, CHIP_LABEL } from "./loungePrompts";

describe("coerceSuggestedAction (B-1 / S1)", () => {
  it("passes through the known actions", () => {
    expect(coerceSuggestedAction("strong_sides")).toBe("strong_sides");
    expect(coerceSuggestedAction("trainings")).toBe("trainings");
    expect(coerceSuggestedAction("audit")).toBe("audit");
  });

  it("returns null for absent / null / unknown (graceful degradation)", () => {
    expect(coerceSuggestedAction(undefined)).toBeNull();
    expect(coerceSuggestedAction(null)).toBeNull();
    expect(coerceSuggestedAction("")).toBeNull();
    expect(coerceSuggestedAction("explore")).toBeNull();
    expect(coerceSuggestedAction(42)).toBeNull();
    expect(coerceSuggestedAction({ action: "strong_sides" })).toBeNull();
  });

  it("no in-app record CTA: record_again is not a chip (points at the official button instead)", () => {
    expect(coerceSuggestedAction("record_again")).toBeNull();
  });

  it("every action has a label", () => {
    for (const a of ["strong_sides", "trainings", "audit"] as const) {
      expect(CHIP_LABEL[a]).toBeTruthy();
    }
  });
});
