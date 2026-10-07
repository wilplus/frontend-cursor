import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapPracticeCheck } from "./practiceCheck";

describe("mapPracticeCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps only next and key from a praise check", () => {
    const mapped = mapPracticeCheck({
      outcome: "done",
      check: { next: "praise", key: "B02", lane: "cue", z: 1.4 },
      attempt_transcript: "x",
      practice: {},
    });
    expect(mapped).toEqual({ next: "praise", key: "B02" });
    expect(Object.keys(mapped)).toEqual(["next", "key"]);
  });

  it("maps an unknown next to again", () => {
    expect(mapPracticeCheck({ check: { next: "score", key: "B02" } })).toEqual({
      next: "again",
      key: "B02",
    });
  });

  it("maps a missing check to again and a null key", () => {
    expect(mapPracticeCheck({ outcome: "done" })).toEqual({ next: "again", key: null });
  });
});
