// @vitest-environment jsdom
/*
STORY    As a speaker continuing a project, I want my chosen fragment
         to apply to one Take, so that later practices keep their own choices.
OUTCOME  O1  The choice is scoped to account and project.
         O2  A consumed recording choice clears before the next Take.
PROVES   O1 -> "keeps my fragment private to my account and project"
         O2 -> "clears the recording choice after it is consumed"
WHY      Founder 2026-11-15: timer and fragment choice belong to continuation.
*/
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPracticeResume,
  readPracticeResume,
  writePracticeResume,
} from "./practiceResume";

describe("practice resume selection", () => {
  beforeEach(() => localStorage.clear());

  it("keeps my fragment private to my account and project", () => {
    writePracticeResume("u1", "a1", { scope: "fragment", startSlide: 3, endSlide: 5 });
    expect(readPracticeResume("u1", "a1")).toEqual({
      scope: "fragment", startSlide: 3, endSlide: 5,
    });
    expect(readPracticeResume("u2", "a1")).toBeNull();
  });

  it("clears the recording choice after it is consumed", () => {
    writePracticeResume(null, "a1", { scope: "whole" });
    clearPracticeResume(null, "a1");
    expect(readPracticeResume(null, "a1")).toBeNull();
  });

  it("restores my fragment saved before the scope-contract update", () => {
    localStorage.setItem("willab_practice_resume:v1:guest:a1", JSON.stringify({
      durationSeconds: 300, slideIndex: 2, scope: "fragment", startSlide: 3, endSlide: 5,
    }));
    expect(readPracticeResume(null, "a1")).toEqual({
      scope: "fragment",
      startSlide: 3,
      endSlide: 5,
    });
  });
});
