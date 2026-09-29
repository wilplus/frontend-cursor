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

  it("is the one door on the blind card and the overlay's practice review", () => {
    const card = readFileSync(
      "src/components/willab/CoachSnippetReviewCard.tsx", "utf8");
    const overlay = readFileSync(
      "src/components/willab/CoachStarVerdictOverlay.tsx", "utf8");
    expect(card).toContain("const answered = opensPracticeDoor(rating);");
    expect(card).toContain("opensPracticeDoor(rating, unrateable)");
    expect(card).not.toContain('rating === "yes" || rating === "no"');
    expect(overlay).toContain(
      "opensPracticeDoor(row.label?.value, row.label?.unrateable)");
    // The old door opened on a row with no label at all. (blindComplete
    // keeps that shape on purpose: an abstention does complete the pass.)
    expect(overlay).not.toMatch(
      /enabled=\{\s*COACH_GUIDANCE_D3_UI_ENABLED &&\s*\(row\.label\?\.value !== null/,
    );
  });
});
