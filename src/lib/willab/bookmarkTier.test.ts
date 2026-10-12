/* -------------------------------------------------------------------------- */
/*  THE BOOKMARK LADDER, ON THE PAGE                                           */
/*  (founder 2026-09-18: "There are no green bookmarks. It seems like none of  */
/*   that actually landed.")                                                   */
/*                                                                            */
/*  It had not: the tier was computed on the backend's internal frame and      */
/*  dropped before the row reached the browser, so every bookmark could only   */
/*  render one colour. The backend now sends it; these are the rules for       */
/*  turning it into the one mark a paragraph wears (contract 24g).             */
/* -------------------------------------------------------------------------- */
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

describe("one paragraph wears one bookmark (founder lock 2026-09-30, B7)", () => {

  it("a weak read with nothing to practise draws no bar: it is an ordinary item", () => {
    // "If it was below and it was matched like you need to practise it, it
    // should be orange. When none it should stay black."
    expect(tierOf([item({ id: "a", bookmarkTier: "weak" })])).toBe("standard");
  });
});
