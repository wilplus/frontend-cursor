import { describe, expect, it } from "vitest";
import { FOUNDER_EMAIL, isFounderEmail } from "./founder";

describe("the founder account", () => {
  it("matches the founder's email, case and whitespace aside", () => {
    expect(isFounderEmail(FOUNDER_EMAIL)).toBe(true);
    expect(isFounderEmail(`  ${FOUNDER_EMAIL.toUpperCase()} `)).toBe(true);
  });
  it("matches nobody else, and no email at all", () => {
    expect(isFounderEmail("coach@willonski.com")).toBe(false);
    expect(isFounderEmail("")).toBe(false);
    expect(isFounderEmail(null)).toBe(false);
    expect(isFounderEmail(undefined)).toBe(false);
  });
});
