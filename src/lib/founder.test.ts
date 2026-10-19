/*
 * STORY    As the founder, I want founder-only tools to recognise only my
 *          account, so that nobody else gets them and I am never locked out.
 * OUTCOME
 *   O1  The founder email matches, also with other letter case and spaces.
 *   O2  Any other email, an empty one and a missing one do not match.
 * PROVES   O1 -> "recognises the founder's own email"
 *          O2 -> "matches nobody else, and no email at all"
 */
import { describe, expect, it } from "vitest";
import { FOUNDER_EMAIL, isFounderEmail } from "./founder";

describe("the founder account", () => {
  it("recognises the founder's own email", () => {
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
