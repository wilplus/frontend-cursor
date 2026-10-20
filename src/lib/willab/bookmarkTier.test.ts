/*
 * STORY    As a speaker, I want each paragraph to wear one bookmark colour by
 *          the founder's rules, so that the colours mean something.
 * OUTCOME
 *   O1  Weak with nothing to practise: plain ("standard", no bar).
 *   O2  Weak with a practise: orange ("weak").
 *   O3  Confident: green ("confident").
 *   O4  One mark per paragraph: orange wins over green on the same paragraph.
 * PROVES   O1 -> "a weak read with nothing to practise draws no bar"
 *          O2, O3 -> "a weak read with a practise is orange, a confident read is green"
 *          O4 -> "a paragraph with both reads wears one mark, the orange one"
 * WHY      Founder 2026-09-18 "There are no green bookmarks"; lock 2026-09-30 B7.
 */
import { describe, expect, it } from "vitest";
import { buildDeckChunks, type DeckSuggestionLite } from "./deckChunks";

const DOC = "First paragraph words.\n\nSecond paragraph words.";

const item = (
  over: Partial<DeckSuggestionLite> & { id: string },
): DeckSuggestionLite => ({
  start: 0,
  end: 22,
  status: null,
  ...over,
});

const tierOf = (suggestions: DeckSuggestionLite[]) =>
  buildDeckChunks(DOC, null, suggestions)[0]?.tier ?? null;

const PRACTISE = { id: "ex-1" };

describe("one paragraph wears one bookmark (founder lock 2026-09-30, B7)", () => {
  it("a weak read with nothing to practise draws no bar", () => {
    expect(tierOf([item({ id: "a", bookmarkTier: "weak" })])).toBe("standard");
  });

  it("a weak read with a practise is orange, a confident read is green", () => {
    expect(
      tierOf([item({ id: "a", bookmarkTier: "weak", practiceExercise: PRACTISE })]),
    ).toBe("weak");
    expect(tierOf([item({ id: "a", bookmarkTier: "confident" })])).toBe("confident");
  });

  it("a paragraph with both reads wears one mark, the orange one", () => {
    const chunks = buildDeckChunks(DOC, null, [
      item({ id: "a", bookmarkTier: "confident" }),
      item({ id: "b", bookmarkTier: "weak", practiceExercise: PRACTISE }),
    ]);
    expect(chunks[0]?.tier).toBe("weak");
    // The second paragraph has no item on it and wears nothing.
    expect(chunks[1]?.tier ?? null).toBeNull();
  });
});
