import { describe, expect, it } from "vitest";
import {
  coerceSuggestedAction,
  coerceSuggestedActions,
  CHIP_LABEL,
} from "./loungePrompts";

describe("coerceSuggestedAction (B-1 / S1)", () => {
  it("passes through the known actions", () => {
    expect(coerceSuggestedAction("trainings")).toBe("trainings");
    expect(coerceSuggestedAction("audit")).toBe("audit");
    expect(coerceSuggestedAction("replace_pdf")).toBe("replace_pdf");
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
    for (const a of [
      "trainings",
      "audit",
      "create_new_project",
      "replace_pdf",
      "create_project_from_updated_deck",
      "keep_current_project",
      "edit_current_slide",
    ] as const) {
      expect(CHIP_LABEL[a]).toBeTruthy();
    }
  });

  it("coerces ordered button pairs and drops unknown or duplicate values", () => {
    expect(
      coerceSuggestedActions([
        "replace_pdf",
        "unknown",
        "create_new_project",
        "replace_pdf",
      ])
    ).toEqual(["replace_pdf", "create_new_project"]);
    expect(coerceSuggestedActions(null)).toEqual([]);
  });
});
