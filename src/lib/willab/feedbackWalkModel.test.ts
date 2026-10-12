import { describe, expect, it } from "vitest";
import {
  WALK_PHASE_SCREENS,
  unansweredJudgements,
  buildFeedbackWalk,
  pickExercise,
  walkStepForPart,
  type FeedbackWalkItem,
  type FeedbackWalkItemExercise,
} from "./feedbackWalkModel";

/* The Feedback walk's model (build plan D-FW-14): only the branches the
   rendered walk tests (walk/*.test.tsx, deckFeedbackWalk.test.tsx) do not
   reach. The order of screens, the clearer version, the exercise's video and
   the judgements are proven on the rendered walk. */

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
  it("a tap opens at the paragraph's moment (Q-B3 A), and not where this phase draws nothing", () => {
    const walk = buildFeedbackWalk({ items: ITEMS, coachNote: true, practiceOn: true, guest: false });
    expect(walk.plan[walkStepForPart(walk, "p3")!]).toMatchObject({ key: "praise", moment: 2 });
    expect(walk.plan[walkStepForPart(walk, "p1")!]).toMatchObject({ key: "praise", moment: 0 });
    expect(walkStepForPart(walk, "p2")).toBeNull();
    expect(walkStepForPart(walk, "nowhere")).toBeNull();
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

  it("Skip settles every judgement the speaker has not answered in this walk", () => {
    const walk = buildFeedbackWalk({ items: JUDGED, coachNote: false, practiceOn: false, guest: false });
    expect(unansweredJudgements(walk.plan, {})).toEqual([0, 1, 2]);
    expect(unansweredJudgements(walk.plan, { 1: "yes" })).toEqual([0, 2]);
  });
});
