import { describe, expect, it } from "vitest";
import { FLOW } from "@/app/dev/feedback-walk/walkFixtures";
import {
  buildWalkPlan,
  walkMoments,
  withOutcomes,
  type WalkMoment,
  type WalkStep,
} from "./walkPlan";

/** The harness's four moments (walkFixtures MOMENTS): praise, clearer,
 *  praise, exercise, all on one slide. */
const HARNESS: WalkMoment[] = [
  { index: 0, slide: 0, praise: true },
  { index: 1, slide: 0, clearer: true },
  { index: 2, slide: 0, praise: true },
  { index: 3, slide: 0, exercise: true },
];

const shape = (steps: readonly WalkStep[]) =>
  steps.map((s) => ({ key: s.key, moment: s.moment ?? null, kind: s.kind ?? null, overlay: s.overlay ?? true }));
const keys = (steps: readonly WalkStep[]) => steps.map((s) => (s.moment == null ? s.key : `${s.key}:${s.moment}`));

describe("buildWalkPlan", () => {
  it("one slide: with the harness's answers laid in, it is the harness FLOW", () => {
    const plan = buildWalkPlan({ moments: HARNESS, coachNote: true, practiceOn: true, guest: false });
    const flow = withOutcomes(plan, { 1: ["again"], 3: ["praise"] });
    // The harness flow opens in the Lounge (walk lock, flow 1; D-FW-12), which
    // is not a step of the plan: the plan starts on the text page.
    const fromThePage = FLOW.filter((s) => s.key !== "lounge") as readonly WalkStep[];
    expect(FLOW[0].key).toBe("lounge");
    expect(shape(flow)).toEqual(shape(fromThePage));
  });

  it("several slides: all praise first, then all practising, then one Judgement time! (Q-B2 A)", () => {
    const moments: WalkMoment[] = [
      { index: 0, slide: 0, clearer: true },
      { index: 1, slide: 0, praise: true },
      { index: 2, slide: 1, exercise: true },
      { index: 3, slide: 2, praise: true },
    ];
    const plan = buildWalkPlan({ moments, coachNote: true, practiceOn: true, guest: false });
    expect(keys(plan)).toEqual([
      "page", "coachnote",
      "praise:1", "helpers:1", "praise:3", "helpers:3",
      "clearer:0", "practise:0", "exVideo:2", "practise:2",
      "intro", "judge:0", "judge:1", "judge:2", "judge:3",
      "community", "end",
    ]);
    expect(plan.find((s) => s.key === "praise" && s.moment === 3)?.slide).toBe(2);
    expect(plan.filter((s) => s.key === "intro")).toHaveLength(1);
  });

  it("a moment already judged gets no judgement; none left means no Judgement time!", () => {
    const judged = HARNESS.map((m) => ({ ...m, judged: true }));
    const plan = buildWalkPlan({ moments: judged, coachNote: false, practiceOn: true, guest: false });
    expect(plan.some((s) => s.key === "intro" || s.key === "judge")).toBe(false);
  });

  it("carries no number, read or score", () => {
    const plan = buildWalkPlan({ moments: HARNESS, coachNote: true, practiceOn: true, guest: false });
    expect(JSON.stringify(plan)).not.toMatch(/score|read|probab|band/i);
  });
});

describe("walkMoments", () => {
  it("one moment per block, in page order, carrying each item's kind", () => {
    const moments = walkMoments([
      { start: 300, slide: 1, blockId: "b2", openCard: "rewrite" },
      { start: 10, slide: 0, blockId: "b1", feedbackFamily: "great_formulation" },
      { start: 320, slide: 1, blockId: "b2", hasExercise: true },
      { start: 500, slide: 2, blockId: "b3", openCard: "coach_request", judged: true },
    ]);
    expect(moments).toEqual([
      { index: 0, slide: 0, praise: true },
      { index: 1, slide: 1, clearer: true, exercise: true },
      { index: 2, slide: 2, practise: true, judged: true },
    ]);
  });
});
