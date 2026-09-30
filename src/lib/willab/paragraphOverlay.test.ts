/* The paragraph overlay's rules (founder lock 2026-09-30, B5, D1, D3, D7,
   Q1): which card, which button, which colour, and the History rows. Pure,
   so the sheet stays a renderer. */
import { describe, expect, it } from "vitest";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { ParagraphHistory } from "@/services/api/bookmarkHistory";
import {
  asJudgementValue,
  historyRows,
  judgementTone,
  nextOpensPicker,
  canAcceptCard,
  overlayFooter,
  ownWordsCard,
  practiseCardOf,
} from "./paragraphOverlay";

const TEXT = "We should ship it now because the data is clear.";

function item(over: Partial<DocumentSuggestion>): DocumentSuggestion {
  return {
    id: "s",
    start: 0,
    end: 21,
    quote: "We should ship it now",
    kind: "advice",
    proposedText: null,
    device: null,
    status: "dismissed",
    ...over,
  } as DocumentSuggestion;
}

const moment = item({
  id: "cv",
  feedbackFamily: "confident_voice",
  source: "confident_voice",
  snippetId: "snip",
  evidence: { projectId: "a", takeSessionId: "t", slideIndex: 0, paragraphIndex: 0, start: 0, end: 21 },
} as unknown as Partial<DocumentSuggestion>);
const withExercise = {
  ...moment,
  practiceExercise: {
    id: "ex",
    instruction: "Land the last word.",
    explanationVideoRef: "https://media/ex.mp4",
    passage: "We should ship it now",
  },
} as unknown as DocumentSuggestion;
const rewrite = item({
  id: "rw",
  feedbackFamily: "rewrite_clarity",
  kind: "replace",
  proposedText: "because the numbers back it",
});
const praise = item({
  id: "pr",
  feedbackFamily: "great_formulation",
  device: "impeccable",
  quote: "the data is clear",
  cueKeys: ["steady_pace"],
} as Partial<DocumentSuggestion>);

describe("the judgement label (D7)", () => {
  it("is the speaker's own answer, in its colour: green, blue, red, yellow, grey", () => {
    expect(judgementTone("yes")).toBe("green");
    expect(judgementTone("in_between")).toBe("blue");
    expect(judgementTone("no")).toBe("red");
    expect(judgementTone("not_sure")).toBe("yellow");
    expect(judgementTone("audio_unclear")).toBe("grey");
  });

  it("reads only the five answers", () => {
    expect(asJudgementValue("yes")).toBe("yes");
    expect(asJudgementValue("acknowledged")).toBeNull();
    expect(asJudgementValue(null)).toBeNull();
  });
});

describe("the practise card (B5, D1, D3)", () => {
  it("is the exercise, with its video, on In-between, No and Not sure", () => {
    for (const answer of ["in_between", "no", "not_sure"] as const) {
      const card = practiseCardOf([withExercise, rewrite], answer, TEXT);
      expect(card?.kind).toBe("exercise");
      if (card?.kind === "exercise") {
        expect(card.video).toBe("https://media/ex.mp4");
        expect(card.instruction).toBe("Land the last word.");
        expect(card.passage).toBe("We should ship it now");
      }
    }
  });

  it("a Yes never opens the library exercise; the praise leads, then the rewrite", () => {
    expect(practiseCardOf([withExercise, rewrite, praise], "yes", TEXT)?.kind).toBe("praise");
    expect(practiseCardOf([withExercise, rewrite], "yes", TEXT)?.kind).toBe("rewrite");
    expect(practiseCardOf([withExercise], "yes", TEXT)).toBeNull();
  });

  it("a Yes shows an exercise the coach chose", () => {
    const coached = {
      ...withExercise,
      practiceExercise: { ...withExercise.practiceExercise, chosenByCoach: true },
    } as DocumentSuggestion;
    expect(practiseCardOf([coached, praise], "yes", TEXT)?.kind).toBe("exercise");
  });

  it("below In-between the rewrite leads the praise; nothing matched is the plain moment (D1)", () => {
    expect(practiseCardOf([moment, rewrite, praise], "no", TEXT)?.kind).toBe("rewrite");
    expect(practiseCardOf([moment, praise], "not_sure", TEXT)?.kind).toBe("praise");
    const plain = practiseCardOf([moment], "no", TEXT);
    expect(plain).toEqual({ kind: "plain", item: moment, text: "We should ship it now", coach: false });
  });

  it("the coach's sentence rides the plain moment only while an error is with the coach (Q5)", () => {
    const sent = { ...moment, coachRequest: { status: "open", kind: "error" } } as DocumentSuggestion;
    expect(practiseCardOf([sent], "no", TEXT)).toMatchObject({ kind: "plain", coach: true });
    const praised = { ...moment, coachRequest: { status: "open", kind: "praise" } } as DocumentSuggestion;
    expect(practiseCardOf([praised], "no", TEXT)).toMatchObject({ kind: "plain", coach: false });
  });

  it("Audio unclear shows no card; a paragraph never judged shows its rewrite or nothing", () => {
    expect(practiseCardOf([withExercise, rewrite, praise], "audio_unclear", TEXT)).toBeNull();
    expect(practiseCardOf([rewrite], null, TEXT)?.kind).toBe("rewrite");
    expect(practiseCardOf([moment], null, TEXT)).toBeNull();
  });
});

describe("the button (B5 as overridden, Q1 B, D3)", () => {
  it("Yes: Next, nothing under it", () => {
    expect(overlayFooter("yes", true)).toEqual({ pill: "next", link: null });
  });
  it("In-between: Next, Practise as the link when a practise can open", () => {
    expect(overlayFooter("in_between", true)).toEqual({ pill: "next", link: "practise" });
    expect(overlayFooter("in_between", false)).toEqual({ pill: "next", link: null });
  });
  it("No and Not sure: Practise with Skip", () => {
    expect(overlayFooter("no", true)).toEqual({ pill: "practise", link: "skip" });
    expect(overlayFooter("not_sure", true)).toEqual({ pill: "practise", link: "skip" });
  });
  it("Audio unclear and no judgement: Next", () => {
    expect(overlayFooter("audio_unclear", true)).toEqual({ pill: "next", link: null });
    expect(overlayFooter(null, true)).toEqual({ pill: "next", link: null });
  });
  it("Next opens the helper words after a Yes or In-between on unsaved words only (24e, B2)", () => {
    expect(nextOpensPicker("yes", null)).toBe(true);
    expect(nextOpensPicker("in_between", null)).toBe(true);
    expect(nextOpensPicker("yes", "ship it")).toBe(false);
    expect(nextOpensPicker("not_sure", null)).toBe(false);
    expect(nextOpensPicker("audio_unclear", null)).toBe(false);
    expect(nextOpensPicker(null, null)).toBe(false);
  });
});

describe("History (Q1)", () => {
  const history: ParagraphHistory = {
    slideIndex: 0,
    versions: [
      { takeIndex: 1, paragraphs: ["We cut onboarding."], at: "2026-09-01T10:00:00Z", answer: "no" },
      { takeIndex: 2, paragraphs: ["Nine days became two."], at: "2026-09-02T10:00:00Z", answer: "in_between" },
      { takeIndex: 3, paragraphs: ["Two days now."], at: "2026-09-03T10:00:00Z" },
    ],
    helperWords: [
      { phrases: ["nine days"], at: "2026-09-01T11:00:00Z" },
      { phrases: ["two days"], at: "2026-09-02T11:00:00Z" },
    ],
    practice: [],
  };

  it("lists earlier Takes as single rows, newest first: Take number, answer, helper words", () => {
    expect(historyRows(history, "Take")).toEqual([
      { label: "Take 2", answer: "in_between", helperWords: "two days" },
      { label: "Take 1", answer: "no", helperWords: "nine days" },
    ]);
  });

  it("is empty with no history", () => {
    expect(historyRows(null, "Take")).toEqual([]);
  });
});

describe("accepting a rewrite (founder 2026-09-30, C11; contract 29b)", () => {
  const rewriteCard = practiseCardOf([moment, rewrite], "no", TEXT);

  it("the card carries the catalogue's signed move, and the praise its line (35f)", () => {
    expect(rewriteCard).toMatchObject({ kind: "rewrite", move: null });
    const moved = { ...rewrite, rewriteMove: "Split the clause." } as DocumentSuggestion;
    expect(practiseCardOf([moment, moved], "no", TEXT)).toMatchObject({ move: "Split the clause." });
    const lined = { ...praise, praiseLine: "You held this one." } as DocumentSuggestion;
    expect(practiseCardOf([moment, lined], "yes", TEXT)).toMatchObject({ kind: "praise", line: "You held this one." });
    expect(practiseCardOf([moment, praise], "yes", TEXT)).toMatchObject({ kind: "praise", line: null });
  });

  it("can be accepted below Yes while it is still open, and only with a host", () => {
    expect(canAcceptCard(rewriteCard, "no", true)).toBe(true);
    expect(canAcceptCard(rewriteCard, "in_between", true)).toBe(true);
    expect(canAcceptCard(rewriteCard, "not_sure", true)).toBe(true);
    expect(canAcceptCard(rewriteCard, "yes", true)).toBe(false);
    expect(canAcceptCard(rewriteCard, "audio_unclear", true)).toBe(false);
    expect(canAcceptCard(rewriteCard, null, true)).toBe(false);
    expect(canAcceptCard(rewriteCard, "no", false)).toBe(false);
    const approved = { ...rewrite, status: "approved" } as DocumentSuggestion;
    expect(canAcceptCard(practiseCardOf([moment, approved], "no", TEXT), "no", true)).toBe(false);
    expect(canAcceptCard(practiseCardOf([moment, praise], "no", TEXT), "no", true)).toBe(false);
  });

  it("the footer is Accept and practise with Keep my words, and a Yes keeps Next", () => {
    expect(overlayFooter("no", true, true)).toEqual({ pill: "accept", link: "keep" });
    expect(overlayFooter("in_between", true, true)).toEqual({ pill: "accept", link: "keep" });
    expect(overlayFooter("yes", true, true)).toEqual({ pill: "next", link: null });
    // Without an accept, exactly as before.
    expect(overlayFooter("no", true, false)).toEqual({ pill: "practise", link: "skip" });
  });

  it("Keep my words below In-between practises the moment's own words", () => {
    expect(ownWordsCard([moment, rewrite], TEXT)).toEqual({
      kind: "plain", item: moment, text: "We should ship it now", coach: false,
    });
    expect(ownWordsCard([rewrite], TEXT)).toMatchObject({ kind: "plain", item: null, text: TEXT });
  });
});
