/*
 * STORY    As a coach, I want every moment a speaker meets in the Feedback
 *          walk to reach my queue, so that no speaker's Take goes unheard.
 * OUTCOME  (momentsOpenedOn: the "opened" record the coach's queue reads)
 *   O1  Each moment screen of the walk (green moment, clearer version,
 *       exercise, the coach's answer) records its clips as opened, with
 *       what was on screen.
 *   O2  Screens that show no moment (helper words, the coach's word for the
 *       Take, the summary) record nothing.
 * PROVES   O1 -> "every moment screen records its clips as opened"
 *          O2 -> "a screen without a moment records nothing"
 * WHY      Founder 2026-10-20: a new speaker's Takes never reached a coach,
 *          because the walk (lock 2026-10-12) stopped writing the record the
 *          queue filters on (N48.2).
 */
import { describe, expect, it } from "vitest";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { FeedbackWalkMoment } from "@/lib/willab/feedbackWalkModel";
import type { WalkStep } from "@/lib/willab/walkPlan";
import { momentsOpenedOn } from "./useDeckFeedbackWalk";

const clip = (snippetId: string) => ({ takeSessionId: "take-1", snippetId }) as unknown as DocumentSuggestion;

const moment = (over: Partial<FeedbackWalkMoment<DocumentSuggestion>> = {}): FeedbackWalkMoment<DocumentSuggestion> => ({
  index: 0,
  partId: "p1",
  paragraphText: "words",
  slideLabel: null,
  praiseWords: [],
  clip: null,
  clearer: null,
  practiseItem: null,
  exercise: null,
  judgeItem: clip("snip-1"),
  ...over,
});

const step = (key: WalkStep["key"]): WalkStep => ({ key, moment: 0, slide: 0 });

describe("the walk reaches the coach", () => {
  it("every moment screen records its clips as opened", () => {
    expect(momentsOpenedOn(step("praise"), moment())).toEqual([{ snippetId: "snip-1", shown: ["praise"] }]);
    expect(momentsOpenedOn(step("clearer"), moment())).toEqual([{ snippetId: "snip-1", shown: ["rewrite"] }]);
    expect(momentsOpenedOn(step("exVideo"), moment())).toEqual([{ snippetId: "snip-1", shown: ["exercise"] }]);
    expect(momentsOpenedOn(step("coach"), moment())).toEqual([{ snippetId: "snip-1", shown: ["coach_answer"] }]);
    // A coach's answer on the same screen is said too.
    const answered = moment({ coachAnswer: { kind: "note", text: "Breathe.", videoUrl: null } });
    expect(momentsOpenedOn(step("praise"), answered)[0].shown).toEqual(["praise", "coach_answer"]);
  });

  it("a screen without a moment records nothing", () => {
    expect(momentsOpenedOn(step("helpers"), moment())).toEqual([]);
    expect(momentsOpenedOn({ key: "coachnote" }, null)).toEqual([]);
    expect(momentsOpenedOn({ key: "summary" }, null)).toEqual([]);
  });
});
