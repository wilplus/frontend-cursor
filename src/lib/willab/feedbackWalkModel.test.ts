import { describe, expect, it } from "vitest";
import {
  WALK_PHASE_SCREENS,
  buildFeedbackWalk,
  walkStart,
  walkStepForPart,
  type FeedbackWalkItem,
} from "./feedbackWalkModel";

/* The Feedback walk as mounted in this phase (build plan D-FW-14): the plan
   cut to the coach's note, the praise and the helper words, then the end. */

const item = (over: Partial<FeedbackWalkItem> & { partId: string; start: number }): FeedbackWalkItem => ({
  slide: 0,
  paragraphText: `words of ${over.partId}`,
  slideLabel: "Slide 1",
  ...over,
});

const ITEMS: FeedbackWalkItem[] = [
  item({ partId: "p1", start: 0, blockId: "b1", feedbackFamily: "confident_voice", clip: { src: "a.wav", startOffsetMs: 0, durationMs: 9000 } }),
  item({ partId: "p1", start: 5, blockId: "b1", feedbackFamily: "great_formulation", praiseWords: ["A signed line."] }),
  item({ partId: "p2", start: 50, blockId: "b2", openCard: "rewrite" }),
  item({ partId: "p3", start: 90, blockId: "b3", openCard: "praise", praiseWords: ["Another."] }),
];

describe("buildFeedbackWalk", () => {
  it("keeps the locked order, cut to this phase's screens", () => {
    const walk = buildFeedbackWalk({ items: ITEMS, coachNote: true, practiceOn: true, guest: false });
    expect(walk.plan.map((s) => s.key)).toEqual([
      "page", "coachnote", "praise", "helpers", "praise", "helpers", "end",
    ]);
    for (const step of walk.plan) expect(WALK_PHASE_SCREENS.has(step.key)).toBe(true);
  });

  it("draws each moment from its own items: the praise's paragraph, words and voice", () => {
    const walk = buildFeedbackWalk({ items: ITEMS, coachNote: false, practiceOn: true, guest: false });
    expect(walk.moments).toHaveLength(3);
    expect(walk.moments[0]).toMatchObject({
      partId: "p1",
      paragraphText: "words of p1",
      praiseWords: ["A signed line."],
      clip: { src: "a.wav" },
    });
    // A moment with no praise carries no words: none are made up.
    expect(walk.moments[1].praiseWords).toEqual([]);
  });

  it("opens on the coach's note when there is one, else on the first praise", () => {
    const withNote = buildFeedbackWalk({ items: ITEMS, coachNote: true, practiceOn: true, guest: false });
    expect(withNote.plan[walkStart(withNote)!].key).toBe("coachnote");
    const without = buildFeedbackWalk({ items: ITEMS, coachNote: false, practiceOn: true, guest: false });
    expect(without.plan[walkStart(without)!]).toMatchObject({ key: "praise", moment: 0 });
  });

  it("has nowhere to open when this phase has nothing to show", () => {
    const walk = buildFeedbackWalk({ items: [ITEMS[2]], coachNote: false, practiceOn: true, guest: false });
    expect(walkStart(walk)).toBeNull();
  });

  it("a tap opens at the paragraph's moment (Q-B3 A), and not where this phase draws nothing", () => {
    const walk = buildFeedbackWalk({ items: ITEMS, coachNote: true, practiceOn: true, guest: false });
    expect(walk.plan[walkStepForPart(walk, "p3")!]).toMatchObject({ key: "praise", moment: 2 });
    expect(walk.plan[walkStepForPart(walk, "p1")!]).toMatchObject({ key: "praise", moment: 0 });
    expect(walkStepForPart(walk, "p2")).toBeNull();
    expect(walkStepForPart(walk, "nowhere")).toBeNull();
  });

  it("marks every screen read-only for a guest", () => {
    const walk = buildFeedbackWalk({ items: ITEMS, coachNote: true, practiceOn: true, guest: true });
    for (const step of walk.plan) {
      if (step.overlay !== false) expect(step.readOnly).toBe(true);
    }
  });
});
