/*
STORY    As a speaker waiting between Takes, I want progress messages in words,
         with no counts and at most two sentences, so that I am not
         discouraged by numbers or buried in text.
OUTCOME
  O1  Never-1: no line the app says between Takes shows a number, a
      percentage or an "x of y" counter; every line still says something.
  O2  No state says more than two sentences (the failure state shows
      `failed` and `failedNext` together, so the pair counts as one state).
PROVES   O1 -> "says every state in words, never a number, percentage or counter"
         O2 -> "never says a third sentence in one state"
WHY      Never-1 and the founder's length rule (docs/ideal-text-flow-communication.md).
*/
import { describe, expect, it } from "vitest";
import { FLOW_COPY } from "./flowCopy";

const ALL = Object.entries(FLOW_COPY);

function sentences(text: string): number {
  return text.split(/[.!?](?:\s|$)/).filter((s) => s.trim().length > 0).length;
}

describe("FLOW_COPY", () => {
  it("says every state in words, never a number, percentage or counter", () => {
    expect(ALL.length).toBeGreaterThan(0);
    for (const [key, line] of ALL) {
      expect(line, `${key}: says nothing`).toMatch(/[A-Za-z]{2,}/);
      expect(line, `${key}: digits leaked`).not.toMatch(/\d/);
      expect(line, `${key}: percentage leaked`).not.toContain("%");
      expect(line, `${key}: counter shape leaked`).not.toMatch(
        /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+of\s+/i
      );
    }
  });

  it("never says a third sentence in one state", () => {
    for (const [key, line] of ALL) {
      expect(sentences(line), `${key}: too long`).toBeGreaterThanOrEqual(1);
      expect(sentences(line), `${key}: too long`).toBeLessThanOrEqual(2);
    }
    expect(
      sentences(`${FLOW_COPY.failed} ${FLOW_COPY.failedNext}`),
      "failure state: too long"
    ).toBeLessThanOrEqual(2);
  });
});
