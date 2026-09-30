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
  it("draws green when the item is read above the confident threshold", () => {
    expect(tierOf([item({ id: "a", bookmarkTier: "confident" })])).toBe(
      "confident",
    );
  });

  it("draws orange when the item is read weak AND a practise is attached", () => {
    expect(
      tierOf([item({ id: "a", bookmarkTier: "weak", practiceExercise: { id: "x" } })]),
    ).toBe("weak");
  });

  it("a weak read with nothing to practise draws no bar: it is an ordinary item", () => {
    // "If it was below and it was matched like you need to practise it, it
    // should be orange. When none it should stay black."
    expect(tierOf([item({ id: "a", bookmarkTier: "weak" })])).toBe("standard");
  });

  it("lets orange outrank green on the same paragraph", () => {
    // The practise is the single thing the speaker is asked to go and DO, so
    // it takes the mark. Ranked, not first-wins: span order is not a priority.
    const both = [
      item({ id: "green", bookmarkTier: "confident" }),
      item({ id: "drill", bookmarkTier: "weak", practiceExercise: { id: "x" } }),
    ];
    expect(tierOf(both)).toBe("weak");
    expect(tierOf([...both].reverse())).toBe("weak");
  });

  it("falls to an ordinary item, no bar, for a read the machine could not make", () => {
    expect(tierOf([item({ id: "a", bookmarkTier: "standard" })])).toBe(
      "standard",
    );
  });

  it("stays null when the backend sends no tier", () => {
    // Safe-ahead: an older backend draws no bar.
    expect(tierOf([item({ id: "a" })])).toBeNull();
  });
});

describe("a settled item stops colouring the page", () => {
  it("ignores an approved item", () => {
    // 24g-1: the clean text IS the settled state, and the document empties as
    // the speaker works rather than accumulating marks.
    expect(
      tierOf([
        item({ id: "a", bookmarkTier: "confident", status: "approved" }),
      ]),
    ).toBeNull();
  });

  it("ignores a dismissed item", () => {
    expect(
      tierOf([
        item({ id: "a", bookmarkTier: "weak", practiceExercise: {}, status: "dismissed" }),
      ]),
    ).toBeNull();
  });

  it("keeps the mark while one item is still undecided", () => {
    expect(
      tierOf([
        item({ id: "done", bookmarkTier: "weak", practiceExercise: {}, status: "approved" }),
        item({ id: "open", bookmarkTier: "confident" }),
      ]),
    ).toBe("confident");
  });
});

describe("the tier belongs to the paragraph it overlaps", () => {
  it("does not leak onto the next paragraph", () => {
    const chunks = buildDeckChunks(DOC, null, [
      item({ id: "a", bookmarkTier: "weak", practiceExercise: {}, start: 0, end: 22 }),
    ]);
    expect(chunks[0].tier).toBe("weak");
    expect(chunks[1]?.tier ?? null).toBeNull();
  });
});
