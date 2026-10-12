import { describe, expect, it } from "vitest";
import { isFounderEmail } from "./founder";

describe("the founder account", () => {
  it("matches nobody else, and no email at all", () => {
    expect(isFounderEmail("coach@willonski.com")).toBe(false);
    expect(isFounderEmail("")).toBe(false);
    expect(isFounderEmail(null)).toBe(false);
    expect(isFounderEmail(undefined)).toBe(false);
  });
});
