import { describe, expect, it } from "vitest";
import {
  WALK_PHASE_SCREENS,
  bankLine,
  buildFeedbackWalk,
  clearerTurn,
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

describe("the clearer version (D-FW-15)", () => {
  const REWRITE = { quote: "We think the window closes.", proposedText: "The window closes.", item: "s-rw" };
  const WITH_REWRITE: FeedbackWalkItem<string>[] = [
    ...(ITEMS as FeedbackWalkItem<string>[]),
    item({ partId: "p4", start: 120, blockId: "b4", feedbackFamily: "rewrite_clarity", rewrite: REWRITE }) as FeedbackWalkItem<string>,
  ];

  it("follows the praise, from the served rewrite, with nothing after it but the end in this phase", () => {
    const walk = buildFeedbackWalk({ items: WITH_REWRITE, coachNote: false, practiceOn: true, guest: false });
    expect(walk.plan.map((s) => s.key)).toEqual(["page", "praise", "helpers", "praise", "helpers", "clearer", "end"]);
    const clearer = walk.moments[walk.plan[5].moment!].clearer!;
    expect(clearer.item).toBe("s-rw");
    expect(clearer.say).toBe("The window closes.");
    expect(clearer.before).toEqual([{ text: "We think the", cut: true }, { text: " window closes." }]);
    expect(clearer.after).toEqual([{ text: "The", fresh: true }, { text: " window closes." }]);
  });

  it("is the `accept` screen with personalised practice off (WQ3 A)", () => {
    const walk = buildFeedbackWalk({ items: WITH_REWRITE, coachNote: false, practiceOn: false, guest: false });
    expect(walk.plan.find((s) => s.key === "clearer")).toMatchObject({ kind: "accept" });
    const on = buildFeedbackWalk({ items: WITH_REWRITE, coachNote: false, practiceOn: true, guest: false });
    expect(on.plan.find((s) => s.key === "clearer")!.kind).toBeUndefined();
  });

  it("is left out where no served rewrite is there to draw it from", () => {
    const walk = buildFeedbackWalk({ items: ITEMS, coachNote: false, practiceOn: true, guest: false });
    expect(walk.plan.some((s) => s.key === "clearer")).toBe(false);
    expect(walk.moments[1].clearer).toBeNull();
  });

  it("opens the walk and a tap on its paragraph when it is all there is", () => {
    const walk = buildFeedbackWalk({ items: WITH_REWRITE.slice(3), coachNote: false, practiceOn: true, guest: false });
    expect(walk.plan[walkStart(walk)!].key).toBe("praise");
    const only = buildFeedbackWalk({ items: WITH_REWRITE.slice(4), coachNote: false, practiceOn: true, guest: false });
    expect(only.plan[walkStart(only)!].key).toBe("clearer");
    expect(only.plan[walkStepForPart(only, "p4")!].key).toBe("clearer");
  });

  it("rotates the signed lines by the clearer versions before it", () => {
    const lines = ["a", "b", "c"];
    expect([0, 1, 2, 3, 4].map((t) => bankLine(lines, t))).toEqual(["a", "b", "c", "a", "b"]);
    const plan = [{ key: "page" }, { key: "clearer" }, { key: "clearer" }, { key: "end" }] as const;
    expect(clearerTurn([...plan], 1)).toBe(0);
    expect(clearerTurn([...plan], 2)).toBe(1);
  });
});
