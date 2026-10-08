import { describe, expect, it } from "vitest";
import {
  WALK_PHASE_SCREENS,
  afterJudging,
  bankLine,
  firstJudgement,
  unansweredJudgements,
  buildFeedbackWalk,
  clearerTurn,
  pickExercise,
  walkStart,
  walkStepForPart,
  type FeedbackWalkItem,
  type FeedbackWalkItemExercise,
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

describe("the exercise (D-FW-17; walk lock flow 8, WQ2 B, Q-B15 A)", () => {
  const offer = (over: Partial<FeedbackWalkItemExercise<string>> = {}): FeedbackWalkItemExercise<string> => ({
    video: null,
    byCoach: false,
    instruction: "Slow down on the last word.",
    say: "Two hires by March keep that lead.",
    item: "s-ex",
    ...over,
  });
  const exerciseItem = (ex: FeedbackWalkItemExercise<string> | null, over: Partial<FeedbackWalkItem<string>> = {}) =>
    item({ partId: "p5", start: 200, blockId: "b5", openCard: "exercise", hasExercise: ex !== null, exercise: ex, ...over }) as FeedbackWalkItem<string>;
  const keysOf = (items: FeedbackWalkItem<string>[], practiceOn = true) =>
    buildFeedbackWalk({ items, coachNote: false, practiceOn, guest: false }).plan.map((s) =>
      s.key === "practise" ? `practise:${s.kind}` : s.key,
    );

  it("picks the coach's video first, then the library's, and with none no video at all", () => {
    const coach = offer({ video: "https://media/coach.mp4", byCoach: true, item: "s-coach" });
    const library = offer({ video: "https://media/library.mp4", item: "s-lib" });
    expect(pickExercise([library, coach])).toMatchObject({ video: "https://media/coach.mp4", item: "s-coach" });
    expect(pickExercise([library, offer({ byCoach: true, item: "s-coach-novideo" })])).toMatchObject({
      video: "https://media/library.mp4",
      item: "s-lib",
    });
    expect(pickExercise([offer({ video: "  " })])).toMatchObject({ video: null, item: "s-ex" });
    expect(pickExercise([])).toBeNull();
  });

  it("the coach's video, then the practise on the exercise's words", () => {
    const walk = buildFeedbackWalk({
      items: [exerciseItem(offer({ video: "https://media/coach.mp4", byCoach: true }))],
      coachNote: false,
      practiceOn: true,
      guest: false,
    });
    expect(walk.plan.map((s) => s.key)).toEqual(["page", "exVideo", "practise", "end"]);
    expect(walk.plan[2]).toMatchObject({ kind: "instruction", attempt: 1 });
    expect(walk.moments[0].exercise).toEqual({
      video: "https://media/coach.mp4",
      instruction: "Slow down on the last word.",
      say: "Two hires by March keep that lead.",
      item: "s-ex",
    });
    expect(walk.plan[walkStart(walk)!].key).toBe("exVideo");
    expect(walk.plan[walkStepForPart(walk, "p5")!].key).toBe("exVideo");
  });

  it("without the coach's, the library exercise's video plays", () => {
    const walk = buildFeedbackWalk({
      items: [exerciseItem(offer({ video: "https://media/library.mp4" }))],
      coachNote: false,
      practiceOn: true,
      guest: false,
    });
    expect(walk.plan.map((s) => s.key)).toEqual(["page", "exVideo", "practise", "end"]);
    expect(walk.moments[0].exercise!.video).toBe("https://media/library.mp4");
  });

  it("with no video at all, the walk goes straight to the practise", () => {
    const walk = buildFeedbackWalk({ items: [exerciseItem(offer())], coachNote: false, practiceOn: true, guest: false });
    expect(walk.plan.map((s) => s.key)).toEqual(["page", "practise", "end"]);
    expect(walk.plan[walkStart(walk)!]).toMatchObject({ key: "practise", kind: "instruction" });
  });

  it("never waits for a coach: a moment still with the coach is said again, with no screen of its own", () => {
    const waiting = item({ partId: "p6", start: 300, blockId: "b6", openCard: "coach_request", item: "s-wait" }) as FeedbackWalkItem<string>;
    const plan = buildFeedbackWalk({ items: [waiting], coachNote: false, practiceOn: true, guest: false }).plan;
    expect(plan.map((s) => (s.key === "practise" ? `practise:${s.kind}` : s.key))).toEqual([
      "page", "practise:moment", "end",
    ]);
    // The coach's exercise, once shared, takes the moment's place: no other
    // state lies between them.
    const shared = { ...waiting, exercise: offer({ video: "https://media/coach.mp4", byCoach: true }), hasExercise: true };
    expect(keysOf([shared])).toEqual(["page", "exVideo", "practise:instruction", "end"]);
    for (const step of plan) expect(WALK_PHASE_SCREENS.has(step.key)).toBe(true);
  });

  it("is left out where the follow-up names an exercise but none is served", () => {
    expect(keysOf([exerciseItem(null)])).toEqual(["page", "end"]);
  });

  it("is not practised, nor its video shown, with personalised practice off", () => {
    expect(keysOf([exerciseItem(offer({ video: "https://media/coach.mp4", byCoach: true }))], false)).toEqual([
      "page", "end",
    ]);
  });

  it("comes after all the praise, in the practising", () => {
    const items = [
      ...(ITEMS as FeedbackWalkItem<string>[]),
      exerciseItem(offer({ video: "https://media/library.mp4" })),
    ];
    expect(keysOf(items)).toEqual([
      "page", "praise", "helpers", "praise", "helpers", "exVideo", "practise:instruction", "end",
    ]);
  });
});

describe("\"Judgement time!\" and the judgements (D-FW-18; walk lock flow 9-10, Q-B6 A)", () => {
  const judged = (over: Partial<FeedbackWalkItem> & { partId: string; start: number }) =>
    item({ ...over, judge: `cv-${over.partId}` });
  const JUDGED: FeedbackWalkItem[] = [
    judged({ partId: "p1", start: 0, blockId: "b1", feedbackFamily: "confident_voice" }),
    item({ partId: "p1", start: 5, blockId: "b1", feedbackFamily: "great_formulation", praiseWords: ["A signed line."] }),
    item({ partId: "p2", start: 50, blockId: "b2", openCard: "rewrite", rewrite: { quote: "the old words", proposedText: "the new words", item: "rw" } }),
    judged({ partId: "p2", start: 51, blockId: "b2", feedbackFamily: "confident_voice" }),
    judged({ partId: "p3", start: 90, blockId: "b3", feedbackFamily: "confident_voice" }),
  ];

  it("comes after the practising: the intro, one judgement per moment still open, then the end", () => {
    const walk = buildFeedbackWalk({ items: JUDGED, coachNote: false, practiceOn: false, guest: false });
    expect(walk.plan.map((s) => (s.moment == null ? s.key : `${s.key}:${s.moment}`))).toEqual([
      "page", "praise:0", "helpers:0", "clearer:1", "intro", "judge:0", "judge:1", "judge:2", "end",
    ]);
    expect(walk.moments.map((m) => m.judgeItem)).toEqual(["cv-p1", "cv-p2", "cv-p3"]);
  });

  it("asks only where the moment's Confident Voice item is there to save the answer on", () => {
    const walk = buildFeedbackWalk({ items: [JUDGED[1], JUDGED[2], JUDGED[4]], coachNote: false, practiceOn: false, guest: false });
    expect(walk.plan.filter((s) => s.key === "judge").map((s) => s.moment)).toEqual([2]);
  });

  it("has no intro with nothing to judge", () => {
    const walk = buildFeedbackWalk({ items: ITEMS, coachNote: false, practiceOn: true, guest: false });
    expect(walk.plan.some((s) => s.key === "intro")).toBe(false);
  });

  it("opens on the intro when the judgements are all there is", () => {
    const walk = buildFeedbackWalk({ items: [JUDGED[0], JUDGED[4]], coachNote: false, practiceOn: true, guest: false });
    expect(walk.plan[walkStart(walk)!].key).toBe("intro");
    // A tap on a paragraph opens its own judgement (Q-B3 A).
    expect(walk.plan[walkStepForPart(walk, "p3")!]).toMatchObject({ key: "judge", moment: 1 });
  });

  it("the judging over, or skipped, the walk goes past it (Q-B6 A: sharing, then the end; the end in this phase)", () => {
    const walk = buildFeedbackWalk({ items: JUDGED, coachNote: false, practiceOn: false, guest: false });
    expect(walk.plan[afterJudging(walk.plan)].key).toBe("end");
    const sharing = [...walk.plan.slice(0, -1), { key: "community" as const }, walk.plan.at(-1)!];
    expect(sharing[afterJudging(sharing)].key).toBe("community");
  });

  it("Skip settles every judgement the speaker has not answered in this walk", () => {
    const walk = buildFeedbackWalk({ items: JUDGED, coachNote: false, practiceOn: false, guest: false });
    expect(unansweredJudgements(walk.plan, {})).toEqual([0, 1, 2]);
    expect(unansweredJudgements(walk.plan, { 1: "yes" })).toEqual([0, 2]);
  });

  it("‹ is off on the first judgement only", () => {
    const walk = buildFeedbackWalk({ items: JUDGED, coachNote: false, practiceOn: false, guest: false });
    const at = (m: number) => walk.plan.findIndex((s) => s.key === "judge" && s.moment === m);
    expect(firstJudgement(walk.plan, at(0))).toBe(true);
    expect(firstJudgement(walk.plan, at(1))).toBe(false);
  });

  it("is read-only for a guest", () => {
    const walk = buildFeedbackWalk({ items: JUDGED, coachNote: false, practiceOn: false, guest: true });
    for (const s of walk.plan.filter((x) => x.key === "intro" || x.key === "judge")) expect(s.readOnly).toBe(true);
  });
});
