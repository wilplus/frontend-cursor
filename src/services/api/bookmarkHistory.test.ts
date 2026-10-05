import { describe, expect, it } from "vitest";
import { mapOwnerAnswers, mapParagraphHistory } from "./bookmarkHistory";

describe("bookmark history payloads", () => {
  it("maps the history, keeping unknown Takes unknown", () => {
    const h = mapParagraphHistory({
      slide_index: 1,
      versions: [
        { version: 1, take_index: 2, paragraphs: ["A."], at: "t" },
        { version: 2, take_index: null, paragraphs: ["B.", 3] },
      ],
      helper_words: [{ phrases: ["a", null], at: "x" }],
      practice: [{ before: "o", after: "n", at: null }],
    });
    expect(h?.versions).toEqual([
      { takeIndex: 2, paragraphs: ["A."], at: "t" },
      { takeIndex: null, paragraphs: ["B."], at: null },
    ]);
    expect(h?.helperWords).toEqual([{ phrases: ["a"], at: "x" }]);
    expect(h?.practice).toEqual([{ before: "o", after: "n", at: null }]);
    expect(mapParagraphHistory({})).toBeNull();
  });

  it("keeps an accepted correction apart from the Takes (N48.1)", () => {
    const h = mapParagraphHistory({
      slide_index: 0,
      versions: [
        { kind: "take", version: 1, take_index: 1, paragraphs: ["A."], at: "t1" },
        {
          kind: "accepted_correction",
          version: null,
          take_index: null,
          paragraphs: ["A, corrected."],
          at: "t2",
        },
        { kind: "take", version: 2, take_index: 2, paragraphs: ["A two."], at: "t3" },
      ],
      helper_words: [],
      practice: [],
    });
    expect(h?.versions).toEqual([
      { takeIndex: 1, paragraphs: ["A."], at: "t1" },
      { takeIndex: 2, paragraphs: ["A two."], at: "t3" },
    ]);
    expect(h?.corrections).toEqual([{ paragraphs: ["A, corrected."], at: "t2" }]);
  });

  it("maps only complete answers", () => {
    expect(
      mapOwnerAnswers({
        answers: [
          { feedback_id: "f1", response: "yes" },
          { feedback_id: "f2" },
          "junk",
        ],
      }),
    ).toEqual([{ feedbackId: "f1", response: "yes" }]);
    expect(mapOwnerAnswers(null)).toEqual([]);
  });
});
