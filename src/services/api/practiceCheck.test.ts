import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapPracticeCheck, mapPracticeCheckResult } from "./practiceCheck";

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

describe("mapPracticeCheck after the third try (CM3a A, CM3b A)", () => {
  it("keeps moved_on and its bank key", () => {
    expect(mapPracticeCheck({ check: { next: "moved_on", key: "CM3b", lane: "none" } })).toEqual({
      next: "moved_on",
      key: "CM3b",
    });
  });
});

describe("mapPracticeCheckResult", () => {
  it("carries the try's own words on a praise, and nothing measured", () => {
    const mapped = mapPracticeCheckResult({
      check: { next: "praise", key: "cue:wide_range", lane: "cue", z: 1.2 },
      attempt_transcript: "we need two hires",
      practice: { id: "p" },
    });
    expect(mapped).toEqual({ check: { next: "praise", key: "cue:wide_range" }, attemptWords: "we need two hires" });
  });

  it("has no words when none came back", () => {
    expect(mapPracticeCheckResult({ check: { next: "again", key: "effort" }, attempt_transcript: null }).attemptWords)
      .toBeNull();
  });
});
