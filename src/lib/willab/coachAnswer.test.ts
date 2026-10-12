/* The one answer, by kind (founder 2026-09-30, A3 to A6; P2-11). Pins: the
 * labels and the video default follow the kind; a note has no home; the
 * Home screen refuses an exercise without a name, a main target or a video;
 * the library id is the request's; a slug is the backend's shape. */
import { describe, expect, it } from "vitest";
import {
  answerPlan, homeDefaults, homeProblem,
} from "./coachAnswer";

describe("the Home screen", () => {
  const spotted = [{ errorId: "rushing", label: "Rushing" }, { errorId: "ending_compression", label: "Ending compression" }];
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
