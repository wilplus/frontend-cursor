/*
STORY    As a speaker, I want the Feedback walk to give every moment a practice step even when no coach has answered, so that a coach never holds up my next Take.
OUTCOME
  O1  A moment with nothing from a coach still gets the exercise screen and is practised; a coach's exercise, once shared, takes its place.
  O2  A step tapped in the Lounge opens that same moment, even after earlier moments were answered.
  O3  A corrected moment with neither a clearer version nor an exercise is still said again (founder 2026-10-20), never dropped.
  O4  Two shown moments on one slide, even in one paragraph, are two moments with their own steps, each named with that slide (founder 2026-10-23, N118).
PROVES   O1 -> never waits for a coach: a moment with nothing served still gets the locked Exercise screen, then is said again
         O2 -> opens the bubble's own moment, found by its paragraph once moments before it are answered
         O3 -> a corrected moment with nothing attached is said again, not dropped
         O4 -> two moments on one long slide are two moments, each named with that slide
WHY      Never-rule 3 (coaches are never in the way of the next Take).
*/
import { describe, expect, it } from "vitest";
import {
  WALK_PHASE_SCREENS,
  buildFeedbackWalk,
  walkStepAt,
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

  it("a corrected moment with nothing attached is said again, not dropped", () => {
    // The score decides each (C2, C4): a shown moment below the floor with
    // no rewrite and no exercise offer is practised as it was said. Its own
    // row is the item the practise opens on.
    const corrected = item({ partId: "p7", start: 400, blockId: "b7", tiered: true, practicePrompt: true, item: "s-own" }) as FeedbackWalkItem<string>;
    const model = buildFeedbackWalk({ items: [corrected], coachNote: false, practiceOn: true, guest: false });
    expect(model.plan.map((s) => (s.key === "practise" ? `practise:${s.kind}` : s.key))).toEqual([
      "page", "exVideo", "practise:moment", "others", "summary", "end",
    ]);
    expect(model.moments[0].practiseItem).toBe("s-own");
  });
});

describe("two moments on one slide (founder 2026-10-23, N118)", () => {
  it("two moments on one long slide are two moments, each named with that slide", () => {
    // One slide, one paragraph, two blocks: the Take's two best moments.
    const onSlide = { partId: "p3", slide: 2, slideLabel: "Slide 3", tiered: true };
    const praised = item({ ...onSlide, start: 0, blockId: "b1", green: true, highest: true, item: "s-1" }) as FeedbackWalkItem<string>;
    const corrected = item({ ...onSlide, start: 400, blockId: "b2", practicePrompt: true, item: "s-2" }) as FeedbackWalkItem<string>;
    const model = buildFeedbackWalk({ items: [praised, corrected], coachNote: false, practiceOn: true, guest: false });
    expect(model.moments.map((m) => [m.index, m.slideLabel, m.highest])).toEqual([
      [0, "Slide 3", true],
      [1, "Slide 3", false],
    ]);
    const stepsOf = (moment: number) => model.plan.filter((s) => s.moment === moment).map((s) => s.key);
    expect(stepsOf(0)).toContain("praise");
    expect(stepsOf(1)).toContain("practise");
  });
});

describe("a step tapped in the Lounge (lock 2026-10-12, section 1)", () => {
  it("opens the bubble's own moment, found by its paragraph once moments before it are answered", () => {
    const open = (partId: string, start: number) =>
      item({ partId, start, blockId: partId, openCard: "coach_request", item: partId }) as FeedbackWalkItem<string>;
    // Posted while p1 still waited, p2's step was moment 1; p1 is answered now.
    const model = buildFeedbackWalk({ items: [open("p2", 200), open("p3", 300)], coachNote: false, practiceOn: true, guest: false });
    const at = walkStepAt(model, { step: "practise", moment: 1, part: "p2" });
    expect(at).not.toBeNull();
    expect(model.moments[model.plan[at as number].moment as number].partId).toBe("p2");
  });
});

describe("the coach's link opens everything the coach sent (founder 2026-10-20)", () => {
  // Three moments the coach touched: an exercise they chose, a clearer
  // version they wrote, a note. And one the coach never touched.
  const chosen = item({
    partId: "p1", start: 0, blockId: "b1", tiered: true, practicePrompt: true, hasExercise: true, coachExercise: true,
    exercise: { video: "coach.mp4", byCoach: true, instruction: "Slow down.", say: "Say it.", item: "s-ex" },
  }) as FeedbackWalkItem<string>;
  const version = item({
    partId: "p2", start: 100, blockId: "b2", tiered: true, coachAnswered: true, coachVersion: true, hasRewrite: true,
    coachAnswer: { kind: "version", text: "We give you your words back.", videoUrl: null }, coachItem: "s-v",
    rewrite: { quote: "So basically we give you your words back.", proposedText: "We give you your words back.", item: "s-v", byCoach: true },
  }) as FeedbackWalkItem<string>;
  const note = item({
    partId: "p3", start: 200, blockId: "b3", tiered: true, coachAnswered: true,
    coachAnswer: { kind: "note", text: "Breathe first.", videoUrl: null }, coachItem: "s-n",
  }) as FeedbackWalkItem<string>;
  const untouched = item({ partId: "p4", start: 300, blockId: "b4", tiered: true, green: true }) as FeedbackWalkItem<string>;
  const walk = (practiceOn = true) =>
    buildFeedbackWalk({ items: [chosen, version, note, untouched], coachNote: true, practiceOn, guest: false, coachOnly: true });

  it("the coach's word, their exercise, their clearer version, their note, and nothing of the machine's", () => {
    const { plan, moments } = walk();
    expect(plan.map((s) => (s.key === "practise" ? `practise:${s.kind}` : s.key))).toEqual([
      "page", "coachnote", "exVideo", "practise:instruction", "clearer", "coach", "end",
    ]);
    // The clearer version is the coach's words, marked as theirs.
    expect(moments[1].clearer?.byCoach).toBe(true);
    expect(moments[1].clearer?.say).toBe("We give you your words back.");
  });

  it("with practice off, the coach's clearer version is still shown and the exercise is not", () => {
    expect(walk(false).plan.map((s) => s.key)).toEqual(["page", "coachnote", "clearer", "coach", "end"]);
  });
});
