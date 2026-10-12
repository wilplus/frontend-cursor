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
