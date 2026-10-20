/*
STORY    As a speaker, I want my paragraph history to list each Take's version
         and keep accepted corrections apart, so that every old version stays
         and I can see where each one came from.
OUTCOME
  O1  The versions list holds only my Takes; an accepted correction is
      listed separately.
PROVES   O1 -> "keeps an accepted correction apart from the Takes (N48.1)"
WHY      Never-rule 5: every old version stays in the history.
*/
import { describe, expect, it, vi } from "vitest";

const bff = vi.fn();
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch: (...a: unknown[]) => bff(...a) }));

import {
  mapParagraphHistory,
} from "./bookmarkHistory";

describe("bookmark history payloads", () => {

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
});
