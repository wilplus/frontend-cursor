// @vitest-environment jsdom
/*
STORY    As a speaker continuing a project, I want my chosen fragment and time
         to apply to one Take, so that later practices keep their own choices.
OUTCOME  O1  The choice is scoped to account and project.
         O2  The durable checkpoint is the slide where recording actually
             stopped, not the slide where it began.
PROVES   O1 -> "keeps duration and slide scoped to the account and project"
         O2 -> "keeps the actual stopping slide after consuming the selection"
WHY      Founder 2026-11-15: timer and fragment choice belong to continuation.
*/
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPracticeResume,
  readPracticeCheckpoint,
  readPracticeResume,
  writePracticeCheckpoint,
  writePracticeResume,
} from "./practiceResume";

describe("practice resume selection", () => {
  beforeEach(() => localStorage.clear());

  it("keeps duration and slide scoped to the account and project", () => {
    writePracticeResume("u1", "a1", { durationSeconds: 240, slideIndex: 2 });
    expect(readPracticeResume("u1", "a1")).toEqual({
      durationSeconds: 240,
      slideIndex: 2,
    });
    expect(readPracticeResume("u2", "a1")).toBeNull();
    expect(readPracticeCheckpoint("u1", "a1")).toBe(-1);
  });

  it("keeps the actual stopping slide after consuming the selection", () => {
    writePracticeResume(null, "a1", { durationSeconds: 300, slideIndex: 1 });
    writePracticeCheckpoint(null, "a1", 3);
    clearPracticeResume(null, "a1");
    expect(readPracticeResume(null, "a1")).toBeNull();
    expect(readPracticeCheckpoint(null, "a1")).toBe(3);
  });
});
