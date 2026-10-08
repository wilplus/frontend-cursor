import { describe, expect, it } from "vitest";
import { FLOW } from "@/app/dev/feedback-walk/walkFixtures";
import {
  WALK_MAX_TRIES,
  afterTry,
  buildWalkPlan,
  stepForMoment,
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

  it("no coach word: no coach note", () => {
    const plan = buildWalkPlan({ moments: HARNESS, coachNote: false, practiceOn: true, guest: false });
    expect(plan.some((s) => s.key === "coachnote")).toBe(false);
    expect(plan[1].key).toBe("praise");
  });

  it("no praise: straight to the practising", () => {
    const plan = buildWalkPlan({
      moments: [{ index: 0, slide: 0, clearer: true }],
      coachNote: false, practiceOn: true, guest: false,
    });
    expect(keys(plan)).toEqual(["page", "clearer:0", "practise:0", "intro", "judge:0", "community", "end"]);
  });

  it("practice off: a clearer version offers Accept, nothing is practised (WQ3 A)", () => {
    const plan = buildWalkPlan({ moments: HARNESS, coachNote: false, practiceOn: false, guest: false });
    expect(plan.some((s) => s.key === "practise" || s.key === "exVideo")).toBe(false);
    expect(plan.find((s) => s.key === "clearer")?.kind).toBe("accept");
    expect(plan.filter((s) => s.key === "judge")).toHaveLength(4);
  });

  it("guest: every screen read-only, so any answer opens sign-up (N32.5)", () => {
    const plan = buildWalkPlan({ moments: HARNESS, coachNote: true, practiceOn: true, guest: true });
    for (const step of plan) {
      expect(step.readOnly ?? false).toBe(step.key !== "page" && step.key !== "end");
    }
  });

  it("a moment already judged gets no judgement; none left means no Judgement time!", () => {
    const judged = HARNESS.map((m) => ({ ...m, judged: true }));
    const plan = buildWalkPlan({ moments: judged, coachNote: false, practiceOn: true, guest: false });
    expect(plan.some((s) => s.key === "intro" || s.key === "judge")).toBe(false);
  });

  it("sharing can be left out", () => {
    const plan = buildWalkPlan({ moments: HARNESS, coachNote: false, practiceOn: true, guest: false, sharing: false });
    expect(plan.some((s) => s.key === "community")).toBe(false);
  });

  it("carries no number, read or score", () => {
    const plan = buildWalkPlan({ moments: HARNESS, coachNote: true, practiceOn: true, guest: false });
    expect(JSON.stringify(plan)).not.toMatch(/score|read|probab|band/i);
  });
});

describe("the practise loop (CM3a A, CM3b A)", () => {
  const first: WalkStep = { key: "practise", moment: 1, slide: 0, kind: "words", attempt: 1 };

  it("praise: checking, the praise, then helper words", () => {
    expect(afterTry(first, "praise").map((s) => s.key)).toEqual(["processing", "improved", "helpers"]);
  });

  it("again: checking, encouragement, the next try", () => {
    const next = afterTry(first, "again");
    expect(next.map((s) => s.key)).toEqual(["processing", "encourage", "practise"]);
    expect(next[2].attempt).toBe(2);
  });

  it("after the third try that is not praise: thanks, and the walk moves on", () => {
    const third = { ...first, attempt: WALK_MAX_TRIES };
    expect(afterTry(third, "again").map((s) => s.key)).toEqual(["processing", "thanks"]);
    const plan = buildWalkPlan({ moments: [{ index: 1, slide: 0, clearer: true }], coachNote: false, practiceOn: true, guest: false });
    const flow = withOutcomes(plan, { 1: ["again", "again", "again"] });
    expect(keys(flow)).toEqual([
      "page", "clearer:1", "practise:1",
      "processing:1", "encourage:1", "practise:1",
      "processing:1", "encourage:1", "practise:1",
      "processing:1", "thanks:1",
      "intro", "judge:1", "community", "end",
    ]);
  });
});

describe("stepForMoment (Q-B3 A)", () => {
  const plan = buildWalkPlan({ moments: HARNESS, coachNote: true, practiceOn: true, guest: false });

  it("opens a moment at its first screen", () => {
    expect(plan[stepForMoment(plan, 0) ?? -1]).toMatchObject({ key: "praise", moment: 0 });
    expect(plan[stepForMoment(plan, 3) ?? -1]).toMatchObject({ key: "exVideo", moment: 3 });
  });

  it("a moment with only its judgement left opens there; none open is null", () => {
    const onlyJudge = buildWalkPlan({ moments: [{ index: 5, slide: 0 }], coachNote: false, practiceOn: true, guest: false });
    expect(onlyJudge[stepForMoment(onlyJudge, 5) ?? -1]).toMatchObject({ key: "judge", moment: 5 });
    expect(stepForMoment(plan, 9)).toBeNull();
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
