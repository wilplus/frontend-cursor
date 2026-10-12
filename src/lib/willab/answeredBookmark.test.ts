import { describe, expect, it } from "vitest";
import {
  opensParagraphSheet,
  helperWordRanges,
  paragraphHeadlines,
} from "./answeredBookmark";

const cv = {
  id: "cv",
  status: "dismissed",
  feedbackFamily: "confident_voice",
  quote: "nine days to two",
  proposedText: null,
};

describe("the answered bookmark (Q19 A)", () => {

  it("opens its own sheet unless a judgement waits; saved words always open it (founder lock 2026-09-30, B5, B8)", () => {
    expect(opensParagraphSheet({ pending: [], decided: [cv] })).toBe(true);
    expect(opensParagraphSheet({ pending: [], decided: [], locked: true })).toBe(true);
    expect(opensParagraphSheet({ pending: [cv], decided: [cv], locked: true })).toBe(false);
    // J10 (founder 2026-09-26): a paragraph with no feedback opens too.
    expect(opensParagraphSheet({ pending: [], decided: [] })).toBe(true);
    // A rewrite or praise still open rides its moment and is the practise
    // card on the paragraph's own sheet (B5): no question to ask.
    const rewrite = { id: "rw", status: null, feedbackFamily: "rewrite_clarity", quote: "q", proposedText: "p" } as const;
    expect(opensParagraphSheet({ pending: [rewrite], decided: [cv] })).toBe(true);
    // Saved helper words: the saved screen whatever waits on it (B8, D9).
    expect(opensParagraphSheet({ pending: [cv], decided: [] }, true)).toBe(true);
  });
});

describe("one headline per paragraph (founder 2026-09-26)", () => {
  it("keys helper words by the paragraph they came from, in pick order", () => {
    const map = paragraphHeadlines([
      { partId: "p2", text: "nine days to two" },
      { partId: "p1", text: "hello" },
      { partId: "p2", text: " first week " },
      { partId: "p2", text: "first week" },
    ]);
    expect(map.get("p2")).toBe("nine days to two · first week");
    expect(map.get("p1")).toBe("hello");
    expect(map.has("p3")).toBe(false);
  });
});

describe("helper words inside the running text", () => {
  it("finds each phrase by its words, ignoring case", () => {
    expect(
      helperWordRanges("We think The Timing matters, and the window.", "the timing matters · window"),
    ).toEqual([[9, 27], [37, 43]]);
  });
  it("marks nothing when the Take did not say them", () => {
    expect(helperWordRanges("Something else entirely.", "the timing matters")).toBeUndefined();
    expect(helperWordRanges("Anything.", null)).toBeUndefined();
  });
});
