import { describe, expect, it } from "vitest";
import {
  answeredView,
  opensAnswered,
  slideHeadlines,
  type DecidedItemLite,
} from "./answeredBookmark";
import { CHUNK_SHEET_COPY as COPY } from "@/components/willab/idealEditCopy";
import type { ParagraphHistory } from "@/services/api/bookmarkHistory";

const cv: DecidedItemLite = {
  id: "cv",
  status: "dismissed",
  feedbackFamily: "confident_voice",
  quote: "nine days to two",
  proposedText: null,
};
const rewrite: DecidedItemLite = {
  id: "rw",
  status: "approved",
  feedbackFamily: "rewrite_clarity",
  quote: "we did cut it",
  proposedText: "now it takes two",
};
const praise: DecidedItemLite = {
  id: "pr",
  status: "approved",
  feedbackFamily: "great_formulation",
  quote: "first week",
  proposedText: null,
};
const history: ParagraphHistory = {
  slideIndex: 2,
  versions: [
    { takeIndex: 1, paragraphs: ["We cut onboarding."], at: null },
    { takeIndex: 3, paragraphs: ["Nine days became two.", "Buddy."], at: null },
  ],
  helperWords: [
    { phrases: ["nine days to two"], at: "a" },
    { phrases: [], at: "b" },
    { phrases: ["nine days to two", "first week"], at: "c" },
  ],
  practice: [{ before: "old", after: "Nine days became two.", at: null }],
};

describe("the answered bookmark (Q19 A)", () => {
  it("says the owner's own answer in the chips' words", () => {
    const view = answeredView({
      items: [cv],
      answers: [{ feedbackId: "cv", response: "in_between" }],
      history: null,
      copy: COPY,
    });
    expect(view.youSaid).toBe("In-between");
  });

  it("draws no answer it does not have", () => {
    const view = answeredView({ items: [cv], answers: [], history: null, copy: COPY });
    expect(view.youSaid).toBeNull();
  });

  it("shows at most two boxes, leaving the praise out first", () => {
    const view = answeredView({
      items: [cv, rewrite, praise],
      answers: [],
      history,
      copy: COPY,
    });
    expect(view.boxes).toEqual([
      { label: "Correction accepted", text: "now it takes two" },
      { label: "From your practice", text: "Nine days became two." },
    ]);
    const two = answeredView({ items: [praise], answers: [], history: null, copy: COPY });
    expect(two.boxes).toEqual([{ label: "Praised", text: "first week" }]);
  });

  it("lists the Slide's words newest first, by Take", () => {
    const view = answeredView({ items: [], answers: [], history, copy: COPY });
    expect(view.versions).toEqual([
      { label: "Take 3", text: "Nine days became two.\n\nBuddy." },
      { label: "Take 1", text: "We cut onboarding." },
    ]);
  });

  it("lists helper words Now then Before, skipping empty sets", () => {
    const view = answeredView({ items: [], answers: [], history, copy: COPY });
    expect(view.helperWords).toEqual([
      { label: "Now", text: "nine days to two · first week" },
      { label: "Before", text: "nine days to two" },
    ]);
  });

  it("opens only when nothing waits and something was answered", () => {
    expect(opensAnswered({ pending: [], decided: [cv] })).toBe(true);
    expect(opensAnswered({ pending: [cv], decided: [cv] })).toBe(false);
    expect(opensAnswered({ pending: [], decided: [] })).toBe(false);
  });
});

describe("one headline per slide (Q20 A)", () => {
  it("joins a slide's helper words in pick order", () => {
    const map = slideHeadlines([
      { slideIndex: 1, text: "nine days to two" },
      { slideIndex: 0, text: "hello" },
      { slideIndex: 1, text: " first week " },
      { slideIndex: 1, text: "first week" },
    ]);
    expect(map.get(1)).toBe("nine days to two · first week");
    expect(map.get(0)).toBe("hello");
    expect(map.has(2)).toBe(false);
  });
});
