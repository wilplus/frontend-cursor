/* The paragraph overlay's rules (founder lock 2026-09-30, B5, D1, D3, D7,
   Q1): which card, which button, which colour, and the History rows. Pure,
   so the sheet stays a renderer. */
import { describe, expect, it } from "vitest";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { ParagraphHistory } from "@/services/api/bookmarkHistory";
import {
  asJudgementValue,
  historyRows,
  nextOpensPicker,
  canAcceptCard,
  ownWordsCard,
  practiseCardOf,
  feedbackFirstCard,
  feedbackFirstFooter,
  shownAtOpen,
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
  it("reads only the five answers", () => {
    expect(asJudgementValue("yes")).toBe("yes");
    expect(asJudgementValue("acknowledged")).toBeNull();
    expect(asJudgementValue(null)).toBeNull();
  });
});

describe("the practise card (B5, D1, D3)", () => {
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

  it("a paragraph never judged shows its rewrite or nothing", () => {
    expect(practiseCardOf([rewrite], null, TEXT)?.kind).toBe("rewrite");
    expect(practiseCardOf([moment], null, TEXT)).toBeNull();
  });
});

describe("the button (B5 as overridden, Q1 B, D3)", () => {
  it("Next opens the helper words on unsaved words only (24e, B2)", () => {
    // Which answers open them is proven on the rendered sheet
    // (judgementFollowUpWalk.test.tsx); saved words are left here.
    expect(nextOpensPicker("yes", "ship it")).toBe(false);
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
    expect(historyRows(history, "Take", "Correction accepted")).toEqual([
      { label: "Take 2", answer: "in_between", helperWords: "two days" },
      { label: "Take 1", answer: "no", helperWords: "nine days" },
    ]);
  });

  // A DELETED SET STAYS IN HISTORY (B4/D4, contract 13; Phase 5).
  it("keeps a set deleted during an earlier Take on that Take's row", () => {
    const deleted: ParagraphHistory = {
      ...history,
      helperWords: [
        { phrases: ["nine days"], at: "2026-09-01T11:00:00Z" },
        { phrases: [], at: "2026-09-01T12:00:00Z" },
        { phrases: ["two days"], at: "2026-09-02T11:00:00Z" },
      ],
    };
    expect(historyRows(deleted, "Take", "Correction accepted")).toEqual([
      { label: "Take 2", answer: "in_between", helperWords: "two days" },
      { label: "Take 1", answer: "no", helperWords: "nine days" },
    ]);
  });

  it("shows the newest Take's row when its words were deleted", () => {
    const deleted: ParagraphHistory = {
      ...history,
      helperWords: [
        ...history.helperWords,
        { phrases: ["two days now"], at: "2026-09-03T11:00:00Z" },
        { phrases: [], at: "2026-09-03T12:00:00Z" },
      ],
    };
    expect(historyRows(deleted, "Take", "Correction accepted")[0]).toEqual(
      { label: "Take 3", answer: null, helperWords: "two days now" },
    );
  });

  // AN ACCEPTED CORRECTION IS ITS OWN ROW (founder 2026-10-05, N48.1; C11).
  it("shows an accepted correction as its own row between the Takes, by time", () => {
    const corrected: ParagraphHistory = {
      ...history,
      corrections: [{ paragraphs: ["Nine days, now two."], at: "2026-09-01T12:00:00Z" }],
    };
    expect(historyRows(corrected, "Take", "Correction accepted")).toEqual([
      { label: "Take 2", answer: "in_between", helperWords: "two days" },
      { label: "Correction accepted", answer: null, helperWords: "nine days" },
      { label: "Take 1", answer: "no", helperWords: "nine days" },
    ]);
  });

  it("keeps a correction made after the newest Take as the version on screen", () => {
    const corrected: ParagraphHistory = {
      ...history,
      corrections: [{ paragraphs: ["Two days, said plainly."], at: "2026-09-04T10:00:00Z" }],
    };
    // The correction is what the paragraph reads now; Take 3 becomes history.
    expect(historyRows(corrected, "Take", "Correction accepted").map((r) => r.label)).toEqual([
      "Take 3",
      "Take 2",
      "Take 1",
    ]);
  });

  it("leaves out a correction with no words or no time, never placing it by guess", () => {
    const corrected: ParagraphHistory = {
      ...history,
      corrections: [
        { paragraphs: ["  "], at: "2026-09-01T12:00:00Z" },
        { paragraphs: ["No time."], at: null },
      ],
    };
    expect(historyRows(corrected, "Take", "Correction accepted")).toEqual(
      historyRows(history, "Take", "Correction accepted"),
    );
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
    // Accept below Yes is proven on the rendered sheet; the rest is here.
    expect(canAcceptCard(rewriteCard, "yes", true)).toBe(false);
    expect(canAcceptCard(rewriteCard, "no", false)).toBe(false);
    const approved = { ...rewrite, status: "approved" } as DocumentSuggestion;
    expect(canAcceptCard(practiseCardOf([moment, approved], "no", TEXT), "no", true)).toBe(false);
    expect(canAcceptCard(practiseCardOf([moment, praise], "no", TEXT), "no", true)).toBe(false);
  });

  it("Keep my words below In-between practises the moment's own words", () => {
    expect(ownWordsCard([moment, rewrite], TEXT)).toEqual({
      kind: "plain", item: moment, text: "We should ship it now", coach: false,
    });
    expect(ownWordsCard([rewrite], TEXT)).toMatchObject({ kind: "plain", item: null, text: TEXT });
  });
});

/* JUDGEMENT AFTER FEEDBACK (24e-1; Phase 6): the card and the button before
   any judgement. */
describe("feedback first", () => {
  const tier = (item: DocumentSuggestion, bookmarkTier: "confident" | "weak") =>
    ({ ...item, bookmarkTier }) as DocumentSuggestion;

  it("a moment that needed work opens on its exercise, else its rewrite, else itself", () => {
    // The exercise is proven on the rendered sheet (feedbackFirst.test.tsx).
    expect(feedbackFirstCard([tier(moment, "weak"), rewrite], "weak", TEXT)?.kind).toBe("rewrite");
    expect(feedbackFirstCard([tier(moment, "weak")], "weak", TEXT)?.kind).toBe("plain");
    expect(feedbackFirstFooter("weak", true, false)).toEqual({ pill: "practise", link: "skip" });
    expect(feedbackFirstFooter("weak", true, true)).toEqual({ pill: "accept", link: "keep" });
  });

  it("nothing to practise reads Next, which asks the judgement", () => {
    expect(feedbackFirstFooter("weak", false, false)).toEqual({ pill: "next", link: null });
    expect(feedbackFirstCard([moment], null, TEXT)).toBeNull();
  });
});

/* THE CARD THE MATRIX NAMES (founder 2026-10-05, N48.1, Wave 1 step 1): the
   backend serves `openCard`, the follow-up matrix's cell at the open, and the
   overlay opens that card -- on the first open, on a reopen, and after an
   In-between, a No or a Not sure. Absent, today's rule holds. */
describe("the card the matrix names (openCard)", () => {
  type Open = DocumentSuggestion["openCard"];
  const routed = (
    base: DocumentSuggestion,
    openCard: Open,
    bookmarkTier: "confident" | "weak" | null = "weak",
    over: Partial<DocumentSuggestion> = {},
  ) => ({ ...base, openCard, bookmarkTier, ...over }) as DocumentSuggestion;

  it("coach_request opens the plain moment with the coach's sentence, not the rewrite", () => {
    const items = [routed(moment, "coach_request"), rewrite, praise];
    const card = feedbackFirstCard(items, "weak", TEXT);
    expect(card).toMatchObject({ kind: "plain", coach: true, text: "We should ship it now" });
    expect(shownAtOpen(card)).toEqual(["coach_request"]);
  });

  it("coach_request holds on a reopen, with the request served open as an error", () => {
    const items = [
      routed(moment, "coach_request", "weak", {
        coachRequest: { status: "open", kind: "error" },
      }),
      rewrite,
    ];
    expect(feedbackFirstCard(items, "weak", TEXT)).toMatchObject({ kind: "plain", coach: true });
  });

  it("coach_request says no sentence once the coach answered, or under another kind", () => {
    const answered = [
      routed(moment, "coach_request", "weak", {
        coachRequest: { status: "answered", kind: "error" },
      }),
      rewrite,
    ];
    expect(feedbackFirstCard(answered, "weak", TEXT)).toMatchObject({ kind: "plain", coach: false });
    const ambiguity = [
      routed(moment, "coach_request", "weak", {
        coachRequest: { status: "open", kind: "ambiguity" },
      }),
    ];
    expect(feedbackFirstCard(ambiguity, "weak", TEXT)).toMatchObject({ kind: "plain", coach: false });
  });

  it("exercise opens the exercise", () => {
    const items = [routed(withExercise, "exercise"), rewrite];
    expect(feedbackFirstCard(items, "weak", TEXT)?.kind).toBe("exercise");
  });

  it("praise opens the praise, even with a rewrite on the paragraph", () => {
    const items = [routed(moment, "praise", "confident"), rewrite, praise];
    expect(feedbackFirstCard(items, "confident", TEXT)?.kind).toBe("praise");
  });

  it("rewrite opens the rewrite, even with an exercise on the moment", () => {
    const items = [routed(withExercise, "rewrite"), rewrite];
    expect(feedbackFirstCard(items, "weak", TEXT)?.kind).toBe("rewrite");
  });

  it("a named card that is not on the paragraph falls back to today's rule", () => {
    expect(feedbackFirstCard([routed(moment, "rewrite")], "weak", TEXT)?.kind).toBe("plain");
    expect(feedbackFirstCard([routed(moment, "praise", "confident"), rewrite], "confident", TEXT)).toBeNull();
    expect(feedbackFirstCard([routed(moment, "exercise"), rewrite], "weak", TEXT)?.kind).toBe("rewrite");
    expect(feedbackFirstCard([routed(moment, "rewrite", null)], null, TEXT)).toBeNull();
  });

  it("absent, today's rule: a weak moment with a rewrite opens the rewrite", () => {
    const items = [routed(moment, null), rewrite];
    expect(feedbackFirstCard(items, "weak", TEXT)?.kind).toBe("rewrite");
    expect(practiseCardOf(items, "no", TEXT)?.kind).toBe("rewrite");
  });

  it("an exercise the coach chose rides the moment whatever the cell", () => {
    const chosen = {
      ...withExercise,
      practiceExercise: { ...withExercise.practiceExercise!, chosenByCoach: true },
    } as DocumentSuggestion;
    const items = [routed(chosen, "praise", "confident"), praise];
    expect(feedbackFirstCard(items, "confident", TEXT)?.kind).toBe("exercise");
  });

  it("after In-between, No or Not sure the named card leads too; Yes and Audio unclear keep their rule", () => {
    const items = [routed(moment, "coach_request"), rewrite, praise];
    expect(practiseCardOf(items, "no", TEXT)).toMatchObject({ kind: "plain", coach: true });
    expect(practiseCardOf(items, "yes", TEXT)?.kind).toBe("praise");
    expect(practiseCardOf(items, "audio_unclear", TEXT)).toBeNull();
  });
});
