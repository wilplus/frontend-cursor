import { describe, expect, it } from "vitest";
import { splitAiBubbleText } from "./bubbleSplit";

describe("splitAiBubbleText", () => {
  it("returns single chunk verbatim when under the cap", () => {
    expect(splitAiBubbleText("Short message.")).toEqual(["Short message."]);
  });

  it("splits at sentence boundaries when total exceeds cap", () => {
    const result = splitAiBubbleText(
      "Your charisma snippets haven't arrived yet, but we can talk! " +
        "Welcome back to the coach surface."
    );
    expect(result).toEqual([
      "Your charisma snippets haven't arrived yet, but we can talk!",
      "Welcome back to the coach surface.",
    ]);
  });

  it("PENDING_GREETING: avoids stranding 'analysis?' alone after 'voice'", () => {
    // Regression for the screenshotted bug where the second sentence
    // was greedy-packed into "...about the voice" + "analysis?". The
    // tail rebalance should merge them into one slightly-oversized
    // bubble rather than splitting the noun phrase.
    const input =
      "Your charisma snippets haven't arrived yet, but we can talk! " +
      "Do you have any questions or would you like to know more about " +
      "the voice analysis?";
    const result = splitAiBubbleText(input);
    expect(result).toEqual([
      "Your charisma snippets haven't arrived yet, but we can talk!",
      "Do you have any questions or would you like to know more about the voice analysis?",
    ]);
  });

  it("keeps tail merge bounded by the soft cap (1.2 × max)", () => {
    // A long sentence whose word-pack tail would be ~50 chars
    // shouldn't merge — that's not a stranded tail anymore, and the
    // merged length would blow well past 1.2 × max.
    const longSentence =
      "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda " +
      "mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega.";
    const result = splitAiBubbleText(longSentence);
    // Must produce more than one chunk and the last chunk shouldn't
    // be tiny (greedy packer's natural boundaries).
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      // Every chunk stays inside 1.2 × max (= 90).
      expect(chunk.length).toBeLessThanOrEqual(90);
    }
  });

  it("returns empty array for empty input", () => {
    expect(splitAiBubbleText("")).toEqual([]);
    expect(splitAiBubbleText("   ")).toEqual([]);
  });
});
