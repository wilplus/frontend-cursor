import { describe, expect, it } from "vitest";
import {
  WALK_PHASE_SCREENS,
  buildFeedbackWalk,
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

  it("never waits for a coach: a moment with nothing served still gets the locked Exercise screen, then is said again", () => {
    const waiting = item({ partId: "p6", start: 300, blockId: "b6", openCard: "coach_request", item: "s-wait" }) as FeedbackWalkItem<string>;
    const plan = buildFeedbackWalk({ items: [waiting], coachNote: false, practiceOn: true, guest: false }).plan;
    expect(plan.map((s) => (s.key === "practise" ? `practise:${s.kind}` : s.key))).toEqual([
      "page", "exVideo", "practise:moment", "others", "summary", "end",
    ]);
    // The coach's exercise, once shared, takes the moment's place: no other
    // state lies between them. The exercise step stands with or without a
    // video (lock 2026-10-12, section 2.4).
    const shared = { ...waiting, exercise: offer({ video: "https://media/coach.mp4", byCoach: true }), hasExercise: true };
    expect(keysOf([shared])).toEqual(["page", "exVideo", "practise:instruction", "others", "summary", "end"]);
    const plain = { ...waiting, exercise: offer(), hasExercise: true };
    expect(keysOf([plain])).toEqual(["page", "exVideo", "practise:instruction", "others", "summary", "end"]);
    for (const step of plan) expect(WALK_PHASE_SCREENS.has(step.key)).toBe(true);
  });
});
