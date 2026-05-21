import { describe, expect, it } from "vitest";
import { computeLabelBool, snippetLabelPrompt } from "./snippetLabel";

describe("computeLabelBool", () => {
  it("coach=charisma + Yes → true (user agrees: it IS charisma)", () => {
    expect(computeLabelBool("charisma", "yes")).toBe(true);
  });

  it("coach=charisma + No → false (user disagrees: NOT charisma)", () => {
    expect(computeLabelBool("charisma", "no")).toBe(false);
  });

  it("coach=stress + Yes → false (it IS stress, so NOT charisma)", () => {
    expect(computeLabelBool("stress", "yes")).toBe(false);
  });

  it("coach=stress + No → true (NOT stress → likely charisma)", () => {
    expect(computeLabelBool("stress", "no")).toBe(true);
  });

  it("symmetry: swapping the question + swapping the answer = same bool", () => {
    // The user pressing "Yes" on charisma-prompt should equal them
    // pressing "No" on stress-prompt — both record "this is charisma".
    expect(computeLabelBool("charisma", "yes")).toBe(
      computeLabelBool("stress", "no")
    );
    expect(computeLabelBool("charisma", "no")).toBe(
      computeLabelBool("stress", "yes")
    );
  });
});

describe("snippetLabelPrompt", () => {
  it("charisma → 'Do you agree this leans into charisma?'", () => {
    expect(snippetLabelPrompt("charisma")).toBe(
      "Do you agree this leans into charisma?"
    );
  });

  it("stress → 'Do you agree this leans into stress?'", () => {
    expect(snippetLabelPrompt("stress")).toBe(
      "Do you agree this leans into stress?"
    );
  });

  it("unknown / future enum value → safe generic fallback", () => {
    expect(snippetLabelPrompt("neutral")).toBe(
      "Do you agree with the coach's read?"
    );
    expect(snippetLabelPrompt("")).toBe(
      "Do you agree with the coach's read?"
    );
  });
});
