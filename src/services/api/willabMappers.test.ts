/*
STORY    As a coach, I want the review context to stay hidden until the server
         unlocks it, even after I've labelled everything, so that my
         judgement stays blind.
OUTCOME
  O1  Without the server's unlock, context stays hidden even when all my
      blind labels are done.
PROVES   O1 -> "keeps context locked when the server sends no gate (audit B4)"
WHY      Never-rule 2: coach judgements stay blind.
*/
import { describe, expect, it } from "vitest";
import { mapCoachReviewSession } from "./coachReview";

describe("mapCoachReviewSession — blind-first context gate", () => {

  it("keeps context locked when the server sends no gate (audit B4)", () => {
    // The blind progress is still derived from the labels, but it never opens
    // context on its own: only the server's context_unlocked does.
    const session = mapCoachReviewSession({
      session_id: "s",
      snippets: [
        {
          id: "one",
          coach_state: { rating_value: "neutral" },
        },
        {
          id: "two",
          coach_state: { rating_unrateable: true },
        },
      ],
    });
    expect(session?.contextUnlocked).toBe(false);
    expect(session?.blindLabel.complete).toBe(true);
  });
});
