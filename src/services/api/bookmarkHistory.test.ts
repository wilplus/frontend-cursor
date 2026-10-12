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
