/* The one answer, by kind (founder 2026-09-30, A3 to A6; P2-11). Pins: the
 * labels and the video default follow the kind; a note has no home; the
 * Home screen refuses an exercise without a name, a main target or a video;
 * the library id is the request's; a slug is the backend's shape. */
import { describe, expect, it } from "vitest";
import {
  answerPlan, answerSteps, exerciseIdFor, homeDefaults, homeProblem, slugFor,
} from "./coachAnswer";

describe("answerPlan", () => {
  it("only the labels and the video default differ by kind", () => {
    expect(answerPlan("error")).toMatchObject({ wordsTitle: "Your instruction", videoDefault: true, home: "exercise", draftSurface: "exercise_script" });
    expect(answerPlan("praise")).toMatchObject({ wordsTitle: "Your praise", videoDefault: false, home: "line", draftSurface: "praise_line" });
    expect(answerPlan("rewrite")).toMatchObject({ wordsTitle: "Your clearer version", videoDefault: false, home: "version", draftSurface: "clearer_version" });
    expect(answerPlan("ambiguity")).toMatchObject({ wordsTitle: "Your note", videoDefault: false, home: "note", draftSurface: null });
  });
  it("a note has no home; everything else walks three screens", () => {
    expect(answerSteps(answerPlan("ambiguity"))).toEqual(["words", "video"]);
    expect(answerSteps(answerPlan("error"))).toEqual(["words", "video", "home"]);
  });
});

describe("the Home screen", () => {
  const spotted = [{ errorId: "rushing", label: "Rushing" }, { errorId: "ending_compression", label: "Ending compression" }];
  it("starts from what fired", () => {
    const home = homeDefaults(answerPlan("error"), spotted);
    expect(home.mainTarget).toBe("rushing");
    expect(home.alsoTreats).toEqual(["ending_compression"]);
    expect(homeDefaults(answerPlan("praise"), spotted).patternKey).toBe("rushing");
    expect(homeDefaults(answerPlan("praise"), []).patternKey).toBe("confident_read");
  });
  it("refuses an exercise without a name, a target or a video", () => {
    const plan = answerPlan("error");
    const base = homeDefaults(plan, spotted);
    expect(homeProblem(plan, base, true, true)).toBe("Give it a name.");
    expect(homeProblem(plan, { ...base, name: "Room to follow", mainTarget: null }, true, true))
      .toBe("Name the one pattern this exercise is written for.");
    expect(homeProblem(plan, { ...base, name: "Room to follow" }, false, true))
      .toContain("needs its video");
    expect(homeProblem(plan, { ...base, name: "Room to follow" }, true, true)).toBeNull();
    expect(homeProblem(answerPlan("praise"), homeDefaults(answerPlan("praise"), []), false, true)).toBeNull();
  });
});

describe("ids", () => {
  it("a moment's exercise is filed under its request", () => {
    expect(exerciseIdFor("req-1")).toBe("coach-request-req-1");
  });
  it("a slug has the backend's shape", () => {
    expect(slugFor("Land the last word")).toBe("land-the-last-word");
    expect(slugFor("  Ünïcode & 3 things ")).toBe("unicode-3-things");
    expect(slugFor("9 lives")).toMatch(/^exercise-/);
    expect(slugFor("")).toBe("exercise-new");
  });
});
