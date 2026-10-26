/*
STORY    As the founder setting a life goal, I want Will to work back from my horizon to this quarter with real dates, so that every step is aimed at the one above it and the quarter is never one that is already ending.
OUTCOME
  O1  Three years asks the year first; ten years asks three years, then the year; a lifetime asks ten years, then the year; one year asks none.
  O2  The quarter's last day is the date, with the weeks left in words; with less than four weeks left it is the next quarter's (the four-week rule).
  O3  The quarter question aims at the step above it, in my words.
  O4  The ladder shows each step with its date, leaves out what I skipped, and shows a changed step's date and earlier words.
PROVES   O1 -> works back from each horizon
         O2 -> applies the four-week rule
         O3 -> aims the quarter at the step above
         O4 -> draws the ladder with dates, changes and gaps
*/
import { describe, expect, it } from "vitest";
import { STEPS_BACK, horizonDate, ladderRungs, quarterEnd, quarterQuestion, stepDate, stepQuestion } from "./lifeGoals";

const october = new Date(2026, 9, 26);
const december = new Date(2026, 11, 15);

describe("life goals: from the horizon to the quarter", () => {
  it("works back from each horizon", () => {
    expect(STEPS_BACK["3y"]).toEqual(["y1"]);
    expect(STEPS_BACK["10y"]).toEqual(["y3", "y1"]);
    expect(STEPS_BACK.life).toEqual(["y10", "y1"]);
    expect(STEPS_BACK["1y"]).toEqual([]);
    expect(horizonDate(october, "3y")).toBe("October 2029");
    expect(stepQuestion(horizonDate(october, "3y"), stepDate(october, "y1"))).toBe(
      "For it to be true by October 2029, where must it be by October 2027?",
    );
    expect(stepQuestion(null, stepDate(october, "y10"))).toBe("It's a lifetime goal. Where must it be by 2036?");
  });

  it("applies the four-week rule", () => {
    expect(quarterEnd(october)).toEqual({ by: "31 December", weeks: "nine weeks from now", next: false });
    expect(quarterEnd(december)).toEqual({ by: "31 March", weeks: "fifteen weeks from now", next: true });
  });

  it("aims the quarter at the step above", () => {
    expect(quarterQuestion("31 December", "nine weeks from now", "A hundred paying teams, and they renew.")).toBe(
      "Then what must be true by 31 December, nine weeks from now, to be on track for “A hundred paying teams, and they renew”?",
    );
    expect(quarterQuestion("31 December", "nine weeks from now", null)).toBe(
      "What must be true by 31 December, nine weeks from now?",
    );
  });

  it("draws the ladder with dates, changes and gaps", () => {
    const rungs = ladderRungs({
      ladder: {
        goal: "Make WillpowerLab the place people learn to speak with confidence.",
        horizon_by: "October 2029",
        give: "Evenings out.",
        steps: { y1: { text: "A hundred paying teams.", by: "October 2027" } },
        quarter: { text: "Twenty paying teams.", by: "31 December", next: false },
      },
      changes: { quarter: { on: "2026-11-03", earlier: "Ten paying teams." } },
      talk: "They book a demo",
    });
    expect(rungs.map((r) => [r.label, r.note])).toEqual([
      ["LIFE GOAL", "by October 2029"],
      ["GIVING UP", null],
      ["IN A YEAR", "by October 2027"],
      ["THIS QUARTER", "by 31 December · changed 3 November"],
      ["TALK GOAL", null],
    ]);
    expect(rungs[3].earlier).toBe("Ten paying teams.");
  });
});
