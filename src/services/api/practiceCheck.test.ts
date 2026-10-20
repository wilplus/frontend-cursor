/*
STORY    As a speaker, I want a practice check to reach my screen only as
         "praise or try again, and which cue", never the machine's number, so
         that I never see a score.
OUTCOME
  O1  The result passed on holds only what to do next and which cue, and
      nothing else.
PROVES   O1 -> "keeps only next and key from a praise check"
WHY      Never-rule 1: no scores or numbers shown to speakers.
*/
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
});
