// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  P1-7 — WHAT FOLLOWS EACH OF THE FIVE JUDGEMENTS (contract 24e, 24f; the   */
/*  founder lock 2026-09-30, B2, B5, D1, D7; 29b).                            */
/*                                                                            */
/*  Walks Yes, In-between, Not sure, No and Audio unclear on a moment the     */
/*  machine read confident and on moments it read weak, through the real     */
/*  paragraph sheet and its real card-choice functions (practiseCardOf,      */
/*  overlayFooter, canAcceptCard, nextOpensPicker), and pins which card, which */
/*  button, which link, and whether Next opens the helper words.             */
/*                                                                            */
/*  The follow-up matrix (24f, founder 2026-09-29):                           */
/*    read confident             praise on Yes, In-between, No, Not sure     */
/*    read weak, problem fired   library video on In-between, No, Not sure;  */
/*                               nothing on Yes                              */
/*    read weak, nothing fired   rewrite on In-between, No, Not sure;        */
/*                               nothing on Yes                              */
/*    Audio unclear              nothing                                     */
/*  Helper words follow Yes and In-between only (B2). Below In-between the    */
/*  card is practised or skipped (B5); a rewrite still open is accepted then */
/*  practised, or the speaker keeps their words (29b).                       */
/*                                                                            */
/*  AFTER the judgement only: the sheet is handed the answer and nothing is  */
/*  awaiting, so the open-time card choice (24e-1, `feedbackFirstCard`, and   */
/*  the `open_card` field being built in parallel) is never on this path.    */
/*                                                                            */
/*  NOT PINNED, on purpose: a weak moment where a problem fired, nothing in   */
/*  the library matched, AND a rewrite rides the paragraph. Today's sheet     */
/*  shows the rewrite there; the matrix says the coach request (audit         */
/*  2026-10-05, item 3). That cell is open work, so it is neither asserted   */
/*  as right nor as wrong here.                                              */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ParagraphSheet from "./ParagraphSheet";
import { forgetParagraphSheetData } from "./paragraphSheetData";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";
import type { DocumentSuggestion } from "@/services/api/idealText";

vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({
  default: () => createElement("div"),
}));
vi.mock("@/services/api/takeFeedback", async (load) => {
  const actual = await load<typeof import("@/services/api/takeFeedback")>();
  return { ...actual, saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })) };
});
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));
vi.mock("@/services/api/confidentVoicePractice", () => ({
  startConfidencePractice: vi.fn(async () => ({ ok: false, error: null })),
  uploadConfidencePracticeAttempt: vi.fn(async () => ({ ok: false, error: null })),
  finishConfidencePractice: vi.fn(async () => ({ ok: false, error: null })),
  fetchConfidencePractice: vi.fn(async () => ({ ok: false, error: null })),
}));
vi.mock("@/services/api/bookmarkHistory", () => ({
  // The answer is handed over by the judgement sheet (`answer`), so the
  // stored read is empty: the sheet must follow the answer just given.
  fetchOwnerAnswers: vi.fn(async () => []),
  fetchParagraphHistory: vi.fn(async () => ({
    slideIndex: 0,
    versions: [{ takeIndex: 1, paragraphs: [TEXT], at: null }],
    helperWords: [],
    practice: [],
  })),
}));

const TEXT = "We should ship it now because the data is clear.";
const QUOTE = "We should ship it now";

type Judgement = "yes" | "in_between" | "not_sure" | "no" | "audio_unclear";
const FIVE: readonly Judgement[] = ["yes", "in_between", "not_sure", "no", "audio_unclear"];

function moment(over: Partial<DocumentSuggestion>): DocumentSuggestion {
  return {
    id: "s-cv",
    start: 0,
    end: QUOTE.length,
    quote: QUOTE,
    kind: "advice",
    proposedText: null,
    device: null,
    status: "dismissed",
    feedbackFamily: "confident_voice",
    source: "confident_voice",
    snippetId: "snip-1",
    takeSessionId: "take-1",
    evidence: {
      projectId: "arc-1",
      takeSessionId: "take-1",
      slideIndex: 0,
      paragraphIndex: 0,
      start: 0,
      end: QUOTE.length,
    },
    ...over,
  } as unknown as DocumentSuggestion;
}

const praise = {
  id: "s-pr", start: 0, end: QUOTE.length, quote: QUOTE, kind: "advice",
  proposedText: null, feedbackFamily: "great_formulation", source: "great_formulation",
  status: null, snippetId: "snip-1", takeSessionId: "take-1",
} as unknown as DocumentSuggestion;

const rewrite = {
  id: "s-rw", start: 0, end: QUOTE.length, quote: QUOTE, kind: "replace",
  proposedText: "We ship it now", feedbackFamily: "rewrite_clarity", source: "rewrite_clarity",
  status: null, snippetId: "snip-1", takeSessionId: "take-1",
} as unknown as DocumentSuggestion;

const libraryVideo = {
  exerciseId: "ex-1", version: 1, title: "Land the end", instruction: "Say it again, slower.",
  introduction: "", yesIntroduction: "", noIntroduction: "",
  explanationVideoRef: "videos/ex-1.mp4", passage: QUOTE, practiceId: null,
  resume: false, doneBefore: false, chosenByCoach: false,
};

/** The moments V3 serves (24f): the Confident Voice item and the note the
 *  machine's read lets its block carry. */
const MOMENTS = {
  confident: {
    decided: [moment({ bookmarkTier: "confident" })],
    pending: [praise],
  },
  weakProblemFired: {
    // The library video matched to the clip; a rewrite on the same paragraph
    // no longer withholds it (24f).
    decided: [moment({ bookmarkTier: "weak", practiceExercise: libraryVideo })],
    pending: [rewrite],
  },
  weakNothingFired: {
    decided: [moment({ bookmarkTier: "weak" })],
    pending: [rewrite],
  },
  weakWithCoach: {
    // A problem fired, nothing in the library matched and no rewrite rides
    // the paragraph: the bookmark is with the coach as an error (35g-2).
    decided: [moment({ bookmarkTier: "weak", coachRequest: { status: "open", kind: "error" } })],
    pending: [],
  },
} as const;

type Expect = {
  card: "praise" | "exercise" | "rewrite" | "plain" | null;
  pill: "next" | "practise" | "accept";
  link: "skip" | "practise" | "keep" | null;
  /** Does Next (or Keep my words on an In-between) open the helper words? */
  helperWords: boolean;
  coachLine?: boolean;
};

const TONE: Record<Judgement, string> = {
  yes: "green",
  in_between: "blue",
  no: "red",
  not_sure: "yellow",
  audio_unclear: "grey",
};

let root: Root;
let container: HTMLDivElement;
let onDone: ReturnType<typeof vi.fn<() => void>>;
let onPractise: ReturnType<typeof vi.fn<(item: DocumentSuggestion, answer: string | null, mode?: string) => void>>;
let onUseHelperWords: ReturnType<typeof vi.fn<(span: unknown) => Promise<boolean>>>;

beforeEach(() => {
  forgetParagraphSheetData();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  onDone = vi.fn<() => void>();
  onPractise = vi.fn<(item: DocumentSuggestion, answer: string | null, mode?: string) => void>();
  onUseHelperWords = vi.fn<(span: unknown) => Promise<boolean>>(async () => true);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function judge(shape: keyof typeof MOMENTS, answer: Judgement) {
  const { decided, pending } = MOMENTS[shape];
  await act(async () => {
    root.render(
      createElement(ParagraphSheet, {
        arcId: "arc-1",
        takeSessionId: "take-1",
        partId: "p1",
        text: TEXT,
        headline: null,
        decided,
        pending,
        // The hand-off: the answer just given in the judgement sheet.
        answer,
        // As the Ideal Text page hosts it (TranscriptReviewDeck): the
        // practise loop reaches every card, and a rewrite can be accepted.
        onPractise,
        onAccept: vi.fn(async () => true),
        practiseEveryCard: true,
        awaiting: null,
        onUseHelperWords,
        onDone,
        onClose: vi.fn(),
      }),
    );
  });
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}

const q = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

/** The footer as drawn: the one black button, and the grey link under it.
 *  Practise is the pill (with its mic) below In-between, the link (plain
 *  text) on an In-between (Q1 B). */
function footer() {
  const practise = Array.from(
    container.querySelectorAll<HTMLElement>('[data-testid="paragraph-sheet-practise"]'),
  );
  const practisePill = practise.find((b) => b.querySelector("svg"));
  const practiseLink = practise.find((b) => !b.querySelector("svg"));
  const pill = q("paragraph-sheet-accept")
    ? "accept"
    : practisePill
      ? "practise"
      : q("paragraph-sheet-next")
        ? "next"
        : null;
  const link = q("paragraph-sheet-skip")
    ? "skip"
    : q("paragraph-sheet-keep")
      ? "keep"
      : practiseLink
        ? "practise"
        : null;
  return { pill, link };
}

async function expectWalk(shape: keyof typeof MOMENTS, answer: Judgement, want: Expect) {
  await judge(shape, answer);
  expect(q("overlay-practise")).not.toBeNull();

  // D7: the speaker's own answer, said back in its colour; never the read.
  const label = q("judgement-label");
  expect(label?.getAttribute("data-tone")).toBe(TONE[answer]);
  expect(label?.textContent).toContain(COPY.judgementWord[answer]);

  const card = q("practise-card");
  expect(card?.getAttribute("data-kind") ?? null).toBe(want.card);
  expect(Boolean(q("coach-request-line"))).toBe(want.coachLine === true);

  expect(footer()).toEqual({ pill: want.pill, link: want.link });

  // AC-9: nothing on the sheet is a number about the speaker.
  expect(q("paragraph-sheet")?.textContent ?? "").not.toMatch(/\d+\s*%|\bscore\b/i);

  // What the way on does: the helper words after Yes and In-between (B2),
  // the walk moving on otherwise. Below In-between with a card to practise
  // the way on is Skip (or, on a rewrite, Keep my words = practise one's own
  // words, 29b).
  const wayOn =
    want.pill === "next"
      ? q("paragraph-sheet-next")
      : want.link === "skip"
        ? q("paragraph-sheet-skip")
        : want.link === "keep"
          ? q("paragraph-sheet-keep")
          : null;
  expect(wayOn).not.toBeNull();
  await act(async () => wayOn!.click());
  expect(Boolean(q("picker-tokens"))).toBe(want.helperWords);
  if (want.helperWords) {
    expect(onDone).not.toHaveBeenCalled();
  } else if (want.link === "keep") {
    // Keep my words below In-between: the practise on the speaker's own words.
    expect(onPractise).toHaveBeenCalledWith(expect.objectContaining({ id: "s-cv" }), answer, "own");
  } else {
    expect(onDone).toHaveBeenCalledTimes(1);
  }
}

describe("a moment the machine read confident: praise now, on every answer but Audio unclear", () => {
  const cases: Record<Judgement, Expect> = {
    yes: { card: "praise", pill: "next", link: null, helperWords: true },
    in_between: { card: "praise", pill: "next", link: "practise", helperWords: true },
    not_sure: { card: "praise", pill: "practise", link: "skip", helperWords: false },
    no: { card: "praise", pill: "practise", link: "skip", helperWords: false },
    audio_unclear: { card: null, pill: "next", link: null, helperWords: false },
  };
  it.each(FIVE)("%s", async (answer) => {
    await expectWalk("confident", answer, cases[answer]);
  });
});

describe("a moment read weak where a problem fired: the library video below Yes, nothing on Yes", () => {
  const cases: Record<Judgement, Expect> = {
    yes: { card: null, pill: "next", link: null, helperWords: true },
    in_between: { card: "exercise", pill: "next", link: "practise", helperWords: true },
    not_sure: { card: "exercise", pill: "practise", link: "skip", helperWords: false },
    no: { card: "exercise", pill: "practise", link: "skip", helperWords: false },
    audio_unclear: { card: null, pill: "next", link: null, helperWords: false },
  };
  it.each(FIVE)("%s", async (answer) => {
    await expectWalk("weakProblemFired", answer, cases[answer]);
  });
});

describe("a moment read weak where nothing fired: the rewrite below Yes, nothing on Yes", () => {
  const cases: Record<Judgement, Expect> = {
    yes: { card: null, pill: "next", link: null, helperWords: true },
    // 29b: the rewrite is accepted then practised; Keep my words on an
    // In-between goes on as Next did, to the helper words.
    in_between: { card: "rewrite", pill: "accept", link: "keep", helperWords: true },
    not_sure: { card: "rewrite", pill: "accept", link: "keep", helperWords: false },
    no: { card: "rewrite", pill: "accept", link: "keep", helperWords: false },
    audio_unclear: { card: null, pill: "next", link: null, helperWords: false },
  };
  it.each(FIVE)("%s", async (answer) => {
    await expectWalk("weakNothingFired", answer, cases[answer]);
  });
});

describe("a moment read weak and with the coach as an error (35g-2, D1)", () => {
  const cases: Partial<Record<Judgement, Expect>> = {
    yes: { card: null, pill: "next", link: null, helperWords: true },
    // No judgement ends on an overlay with nothing to do (D1): the moment to
    // say again, with the coach's signed promise under it (Q5).
    not_sure: { card: "plain", pill: "practise", link: "skip", helperWords: false, coachLine: true },
    no: { card: "plain", pill: "practise", link: "skip", helperWords: false, coachLine: true },
    audio_unclear: { card: null, pill: "next", link: null, helperWords: false },
  };
  it.each(["yes", "not_sure", "no", "audio_unclear"] as const)("%s", async (answer) => {
    await expectWalk("weakWithCoach", answer, cases[answer]!);
  });
});
