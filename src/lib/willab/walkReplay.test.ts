/* The finished walk, played again (founder 2026-10-08, Q-IT643b A):
   buildFeedbackReplay and phraseSelection. */
import { describe, expect, it } from "vitest";
import { buildFeedbackReplay, buildFeedbackWalk, walkStart, type FeedbackWalkItem } from "./feedbackWalkModel";
import { phraseSelection, phraseTokens } from "./phraseTokens";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";

const clip = { src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 9000 };
const ITEMS: FeedbackWalkItem<string>[] = [
  { partId: "p1", start: 0, slide: 1, blockId: "b1", openCard: "praise", paragraphText: "Last quarter our growth doubled.", slideLabel: "Slide 2", praiseWords: ["A signed line."], clip },
  { partId: "p1", start: 1, slide: 1, blockId: "b1", feedbackFamily: "confident_voice", paragraphText: "Last quarter our growth doubled.", slideLabel: "Slide 2", clip, judge: "cv-1" },
  {
    partId: "p2", start: 50, slide: 1, blockId: "b2", feedbackFamily: "rewrite_clarity", paragraphText: "The old words.", slideLabel: "Slide 2", clip,
    rewrite: { quote: "The old words.", proposedText: "The new words.", item: "rw-2" }, item: "rw-2",
  },
  { partId: "p2", start: 51, slide: 1, blockId: "b2", feedbackFamily: "confident_voice", paragraphText: "The old words.", slideLabel: "Slide 2", clip, judge: "cv-2" },
  {
    partId: "p3", start: 90, slide: 1, blockId: "b3", openCard: "exercise", hasExercise: true, paragraphText: "Two hires by March.", slideLabel: "Slide 2", clip,
    exercise: { video: "data:video/mp4;base64,", byCoach: true, instruction: "Land on March.", say: "Two hires by March.", item: "ex-3" },
  },
  { partId: "p3", start: 91, slide: 1, blockId: "b3", feedbackFamily: "confident_voice", paragraphText: "Two hires by March.", slideLabel: "Slide 2", clip, judge: "cv-3" },
];
const ANSWERS: Record<string, ConfidenceRatingValue> = { "cv-1": "yes", "cv-2": "no" };

const replay = (over: Partial<Parameters<typeof buildFeedbackReplay<string>>[0]> = {}) =>
  buildFeedbackReplay<string>({
    items: ITEMS,
    coachNote: true,
    practiceOn: true,
    answerOf: (item) => ANSWERS[item] ?? null,
    helperWordsOf: (partId) => (partId === "p1" ? "growth doubled" : null),
    ...over,
  });

describe("buildFeedbackReplay", () => {
  it("plays the walk's own order, with no practise recorded and a judgement only where one was given", () => {
    const model = replay();
    expect(model.plan.map((s) => `${s.key}${s.moment ?? ""}`)).toEqual([
      "page", "coachnote", "praise0", "helpers0", "clearer1", "exVideo2", "intro", "judge0", "judge1", "end",
    ]);
    // The live walk would record a practise after the clearer version and the exercise.
    const live = buildFeedbackWalk({ items: ITEMS, coachNote: true, practiceOn: true, guest: false });
    expect(live.plan.filter((s) => s.key === "practise")).toHaveLength(2);
    expect(walkStart(model)).toBe(1);
  });

  it("marks only the screens whose taps would write", () => {
    const flagged = replay().plan.filter((s) => s.replay).map((s) => s.key);
    expect(flagged).toEqual(["helpers", "clearer", "exVideo"]);
  });

  it("carries the answers as given: helper words as saved, judgements as answered", () => {
    const model = replay();
    expect(model.replay?.answers).toEqual({ 0: "yes", 1: "no" });
    const tokens = phraseTokens(ITEMS[0].paragraphText).map((t) => t.text);
    const pick = model.replay!.picks[0];
    expect(tokens.slice(pick.from, pick.to + 1)).toEqual(["growth", "doubled."]);
    expect(model.replay!.picks[1]).toBeUndefined();
  });

  it("with no answer given there is no judging at all, and no lone \"Judgement time!\"", () => {
    const keys = replay({ answerOf: () => null }).plan.map((s) => s.key);
    expect(keys).not.toContain("judge");
    expect(keys).not.toContain("intro");
  });

  it("nothing to play: no start", () => {
    expect(walkStart(replay({ items: [], coachNote: false }))).toBeNull();
  });
});

describe("phraseSelection", () => {
  it("finds saved words once, across markers, and never more than four", () => {
    const raw = "We **really** grew in spring and summer.";
    expect(phraseSelection(raw, "really grew")).toEqual({ from: 1, to: 2 });
    expect(phraseSelection(raw, "**really** grew")).toEqual({ from: 1, to: 2 });
    expect(phraseSelection(raw, "We really grew in spring")).toBeNull();
    expect(phraseSelection("go go go", "go")).toBeNull();
    expect(phraseSelection(raw, null)).toBeNull();
    expect(phraseSelection(raw, "autumn")).toBeNull();
  });
});
