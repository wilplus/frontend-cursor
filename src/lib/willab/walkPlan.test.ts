/*
STORY    As a speaker, I want the walk to praise each of my shown moments that sounded sure and practise each that did not, never ask me to judge, never show a score, and give every moment a step, so that feedback is in words and always has something to show.
OUTCOME
  O1  The plan holds no number, read or score.
  O2  The steps come in the locked order: each praise with its helper words, then each correction (clearer version, practise), others, summary, never a judging step; two praises or two corrections are ordinary Takes (founder 2026-10-20).
  O3  Every moment has a practice step, even with nothing attached.
PROVES   O1 -> carries no number, read or score
         O2 -> praises each strong moment, practises each corrected one, and never asks the speaker to judge
         O3 -> a moment with nothing attached is the moment said again
WHY      Never-rule 1 (no scores to speakers).
*/
import { describe, expect, it } from "vitest";
import { buildWalkPlan, walkMoments, type WalkMoment } from "./walkPlan";

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
  const keys = (items: Parameters<typeof walkMoments>[0]) =>
    buildWalkPlan({ moments: walkMoments(items), coachNote: false, practiceOn: true, guest: false }).map((s) => s.key);

  it("praises each strong moment, practises each corrected one, and never asks the speaker to judge", () => {
    // One strong, one weak (a rewrite rides it): praise, then the correction.
    expect(keys([
      { start: 0, slide: 0, blockId: "a", tiered: true, green: true },
      { start: 10, slide: 1, blockId: "b", tiered: true, practicePrompt: true, hasRewrite: true },
      { start: 20, slide: 2, blockId: "c", tiered: true },
    ])).toEqual(["page", "praise", "helpers", "clearer", "practise", "others", "summary", "end"]);
    // Both strong: two praises, nothing to practise (founder 2026-10-20).
    expect(keys([
      { start: 0, slide: 0, blockId: "a", tiered: true, green: true },
      { start: 10, slide: 1, blockId: "b", tiered: true, green: true },
    ])).toEqual(["page", "praise", "helpers", "praise", "helpers", "others", "summary", "end"]);
    // Both weak: two corrections, each its own practise (the second, with
    // nothing attached, is the Exercise screen with Line A, then the mic).
    expect(keys([
      { start: 0, slide: 0, blockId: "a", tiered: true, practicePrompt: true, hasRewrite: true },
      { start: 10, slide: 1, blockId: "b", tiered: true, practicePrompt: true },
    ])).toEqual(["page", "clearer", "practise", "exVideo", "practise", "others", "summary", "end"]);
  });
});

describe("a served moment always has a step (founder 2026-10-17)", () => {
  it("a moment with nothing attached is the moment said again, so the lens never has nothing to show", () => {
    const moments = walkMoments([
      { start: 0, slide: 0, blockId: "b1", feedbackFamily: "confident_voice", openCard: null },
      { start: 90, slide: 1, blockId: "b2", feedbackFamily: "confident_voice", openCard: null },
    ]);
    expect(moments.map((m) => m.practise)).toEqual([true, true]);
  });
});
