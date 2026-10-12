import { describe, expect, it } from "vitest";
import {
  buildWalkPlan,
  walkMoments,
  type WalkMoment,
} from "./walkPlan";

/** The harness's four moments (walkFixtures MOMENTS): praise, clearer,
 *  praise, exercise, all on one slide. */
const HARNESS: WalkMoment[] = [
  { index: 0, slide: 0, praise: true },
  { index: 1, slide: 0, clearer: true },
  { index: 2, slide: 0, praise: true },
  { index: 3, slide: 0, exercise: true },
];

describe("buildWalkPlan", () => {

  it("carries no number, read or score", () => {
    const plan = buildWalkPlan({ moments: HARNESS, coachNote: true, practiceOn: true, guest: false });
    expect(JSON.stringify(plan)).not.toMatch(/score|read|probab|band/i);
  });
});

describe("the 2026-10-12 lock", () => {
  it("praises green moments, practises the one exercise, and never asks the speaker to judge", () => {
    const items = [
      { start: 0, slide: 0, blockId: "a", tiered: true, green: true },
      { start: 10, slide: 1, blockId: "b", tiered: true, practicePrompt: true, hasRewrite: true },
      { start: 20, slide: 2, blockId: "c", tiered: true },
    ];
    const plan = buildWalkPlan({ moments: walkMoments(items), coachNote: false, practiceOn: true, guest: false });
    expect(plan.map((s) => s.key)).toEqual(["page", "praise", "helpers", "clearer", "practise", "others", "end"]);
  });
});
