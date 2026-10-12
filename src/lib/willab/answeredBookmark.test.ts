import { describe, expect, it } from "vitest";
import {
  opensParagraphSheet,
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
