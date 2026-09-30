import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { opensPracticeDoor } from "./stateRatings";

/** Q3 (founder 2026-09-29): any saved answer but Audio unclear opens the
 *  coach's practice review and exercise request. */
describe("the coach's practice door", () => {
  it("opens on the four answers about the moment", () => {
    for (const value of ["yes", "in_between", "no", "not_sure"] as const) {
      expect(opensPracticeDoor(value)).toBe(true);
    }
  });

  it("stays shut on Audio unclear, an abstention flag, and no answer", () => {
    expect(opensPracticeDoor("audio_unclear")).toBe(false);
    expect(opensPracticeDoor("yes", true)).toBe(false);
    expect(opensPracticeDoor(null)).toBe(false);
    expect(opensPracticeDoor(undefined)).toBe(false);
  });

  it("is the one door on the blind card", () => {
    const card = readFileSync(
      "src/components/willab/CoachSnippetReviewCard.tsx", "utf8");
    expect(card).toContain("const answered = opensPracticeDoor(rating);");
    expect(card).toContain("opensPracticeDoor(rating, unrateable)");
    expect(card).not.toContain('rating === "yes" || rating === "no"');
  });
});
