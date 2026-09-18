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

describe("one paragraph wears one bookmark", () => {
  it("draws green when the item is one of the Take's most confident", () => {
    expect(tierOf([item({ id: "a", bookmarkTier: "most_confident" })])).toBe(
      "most_confident",
    );
  });

  it("lets the exercise outrank green on the same paragraph", () => {
    // The exercise is the single thing the speaker is asked to go and DO, so
    // it takes the mark. Ranked, not first-wins: span order is not a priority.
    const both = [
      item({ id: "green", bookmarkTier: "most_confident" }),
      item({ id: "drill", bookmarkTier: "exercise" }),
    ];
    expect(tierOf(both)).toBe("exercise");
    expect(tierOf([...both].reverse())).toBe("exercise");
  });

  it("falls to an ordinary mark for everything else", () => {
    expect(tierOf([item({ id: "a", bookmarkTier: "standard" })])).toBe(
      "standard",
    );
  });

  it("stays null when the backend sends no tier", () => {
    // Safe-ahead: an older backend renders exactly the mark it always did.
    expect(tierOf([item({ id: "a" })])).toBeNull();
  });
});

describe("a settled item stops colouring the page", () => {
  it("ignores an approved item", () => {
    // 24g-1: the clean text IS the settled state, and the document empties as
    // the speaker works rather than accumulating marks.
    expect(
      tierOf([
        item({ id: "a", bookmarkTier: "most_confident", status: "approved" }),
      ]),
    ).toBeNull();
  });

  it("ignores a dismissed item", () => {
    expect(
      tierOf([
        item({ id: "a", bookmarkTier: "exercise", status: "dismissed" }),
      ]),
    ).toBeNull();
  });

  it("keeps the mark while one item is still undecided", () => {
    expect(
      tierOf([
        item({ id: "done", bookmarkTier: "exercise", status: "approved" }),
        item({ id: "open", bookmarkTier: "most_confident" }),
      ]),
    ).toBe("most_confident");
  });
});

describe("the tier belongs to the paragraph it overlaps", () => {
  it("does not leak onto the next paragraph", () => {
    const chunks = buildDeckChunks(DOC, null, [
      item({ id: "a", bookmarkTier: "exercise", start: 0, end: 22 }),
    ]);
    expect(chunks[0].tier).toBe("exercise");
    expect(chunks[1]?.tier ?? null).toBeNull();
  });
});
