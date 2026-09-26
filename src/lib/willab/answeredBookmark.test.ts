import { describe, expect, it } from "vitest";
import {
  answeredView,
  opensParagraphSheet,
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
  it("says the owner's own answer back as one sentence", () => {
    const view = answeredView({
      items: [cv],
      answers: [{ feedbackId: "cv", response: "in_between" }],
      history: null,
      copy: COPY,
    });
    expect(view.youSaid).toBe("You have judged this as your moment in-between");
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

  it("one timeline, newest first, each Take with the helper words locked then (Q26 B)", () => {
    const timed: ParagraphHistory = {
      ...history,
      versions: [
        { takeIndex: 1, paragraphs: ["We cut onboarding."], at: "2026-09-25T10:00:00Z" },
        { takeIndex: 2, paragraphs: ["Nine days became two."], at: "2026-09-25T11:00:00Z" },
        { takeIndex: 3, paragraphs: ["Two days now.", "Buddy."], at: "2026-09-25T12:00:00Z" },
      ],
      helperWords: [
        { phrases: ["nine days to two"], at: "2026-09-25T10:30:00Z" },
        { phrases: [], at: "2026-09-25T11:10:00Z" },
        { phrases: ["two days", "buddy"], at: "2026-09-25T12:30:00Z" },
      ],
    };
    const view = answeredView({ items: [], answers: [], history: timed, copy: COPY });
    expect(view.timeline).toEqual([
      { label: "Take 3", text: "Two days now.\n\nBuddy.", helperWords: "two days · buddy" },
      { label: "Take 2", text: "Nine days became two.", helperWords: null },
      { label: "Take 1", text: "We cut onboarding.", helperWords: "nine days to two" },
    ]);
  });

  it("opens its own sheet only when nothing waits and it was answered or locked", () => {
    expect(opensParagraphSheet({ pending: [], decided: [cv] })).toBe(true);
    expect(opensParagraphSheet({ pending: [], decided: [], locked: true })).toBe(true);
    expect(opensParagraphSheet({ pending: [cv], decided: [cv], locked: true })).toBe(false);
    expect(opensParagraphSheet({ pending: [], decided: [] })).toBe(false);
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
