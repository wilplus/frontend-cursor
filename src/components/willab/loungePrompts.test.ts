import { describe, expect, it } from "vitest";
import {
  coerceSuggestedAction,
  deriveRecordCta,
  CHIP_LABEL,
} from "./loungePrompts";

describe("coerceSuggestedAction (B-1 / S1)", () => {
  it("passes through the three known actions", () => {
    expect(coerceSuggestedAction("strong_sides")).toBe("strong_sides");
    expect(coerceSuggestedAction("trainings")).toBe("trainings");
    expect(coerceSuggestedAction("record_again")).toBe("record_again");
  });

  it("returns null for absent / null / unknown (graceful degradation)", () => {
    expect(coerceSuggestedAction(undefined)).toBeNull();
    expect(coerceSuggestedAction(null)).toBeNull();
    expect(coerceSuggestedAction("")).toBeNull();
    expect(coerceSuggestedAction("explore")).toBeNull();
    expect(coerceSuggestedAction(42)).toBeNull();
    expect(coerceSuggestedAction({ action: "strong_sides" })).toBeNull();
  });

  it("every action has a label", () => {
    for (const a of ["strong_sides", "trainings", "record_again"] as const) {
      expect(CHIP_LABEL[a]).toBeTruthy();
    }
  });
});

describe("deriveRecordCta — locks the record-CTA contract", () => {
  it("record-redirect turn: mic invite + record_again button", () => {
    expect(
      deriveRecordCta({ show_record_ui: true, suggested_action: "record_again" })
    ).toEqual({ showRecordUi: true, action: "record_again" });
  });

  it("mic invite only (no suggested action)", () => {
    expect(deriveRecordCta({ show_record_ui: true })).toEqual({
      showRecordUi: true,
      action: null,
    });
  });

  it("suggested action only (no mic invite)", () => {
    expect(deriveRecordCta({ suggested_action: "trainings" })).toEqual({
      showRecordUi: false,
      action: "trainings",
    });
  });

  it("absent / empty turn → neither (default hidden)", () => {
    expect(deriveRecordCta({})).toEqual({ showRecordUi: false, action: null });
  });

  it("show_record_ui must be strictly boolean true (no truthy coercion)", () => {
    expect(
      deriveRecordCta({ show_record_ui: "true" as unknown as boolean })
        .showRecordUi
    ).toBe(false);
    expect(deriveRecordCta({ show_record_ui: false }).showRecordUi).toBe(false);
  });

  it("unknown suggested_action → no button", () => {
    expect(deriveRecordCta({ suggested_action: "nope" }).action).toBeNull();
  });
});
