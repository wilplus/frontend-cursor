/* The finished walk, played again (founder 2026-10-08, Q-IT643b A):
   buildFeedbackReplay and phraseSelection. */
import { describe, expect, it } from "vitest";
import { buildFeedbackReplay, type FeedbackWalkItem } from "./feedbackWalkModel";
import { phraseSelection } from "./phraseTokens";
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
  it("with no answer given there is no judging at all, and no lone \"Judgement time!\"", () => {
    const keys = replay({ answerOf: () => null }).plan.map((s) => s.key);
    expect(keys).not.toContain("judge");
    expect(keys).not.toContain("intro");
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
