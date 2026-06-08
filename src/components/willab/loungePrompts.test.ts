import { describe, expect, it } from "vitest";
import { postLessonPrompt } from "./loungePrompts";

describe("postLessonPrompt — U9 max-2-negatives guard", () => {
  it("returns null when it wasn't a coach lesson", () => {
    expect(postLessonPrompt("s", null)).toBeNull();
  });

  it("suppresses record-again when > 2 to_work_on → low-pressure anchor, no chips", () => {
    const p = postLessonPrompt("s", 3);
    expect(p?.id).toBe("anchor:s");
    expect(p?.chipActions).toEqual([]);
  });

  it("offers record-again at and below the boundary (<= 2)", () => {
    for (const n of [0, 1, 2]) {
      const p = postLessonPrompt("s", n);
      expect(p?.id).toBe("again:s");
      expect(p?.chipActions).toEqual(["record_again"]);
    }
  });
});
