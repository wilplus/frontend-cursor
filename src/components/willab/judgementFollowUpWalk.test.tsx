// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  STORY    As a speaker, I want the card and buttons after each of my five  */
/*           answers to follow the founder's follow-up matrix, so that I get  */
/*           the right next step (praise, exercise, rewrite, or nothing).     */
/*  OUTCOME  For each answer and machine read, through the real paragraph     */
/*           sheet: the right card, button, link, and whether helper words    */
/*           follow (24f, founder 2026-09-29; locks B2, B5, D1, D7; 29b):     */
/*    O1  read confident: praise on Yes, In-between, No, Not sure.            */
/*    O2  read weak, problem fired: library video on No and Not sure, even    */
/*        with a rewrite on the paragraph; the plain moment with the coach's  */
/*        line when nothing in the library matched; nothing on Yes.          */
/*    O3  read weak, nothing fired: the rewrite (accept, or Keep my words).   */
/*    O4  Audio unclear: nothing.                                             */
/*    O5  Helper words follow Yes and In-between only.                        */
/*    O6  Not sure walks exactly as No.                                       */
/*    O7  Never-1: nothing on the sheet is a number or score about me.        */
/*  PROVES   O1-O7 -> each row of CASES, via expectWalk (card, footer,        */
/*           the way on, and the no-number check on the drawn sheet).         */
/*  NOT PINNED, on purpose: a weak moment where a problem fired, nothing in   */
/*  the library matched, AND a rewrite rides the paragraph. That cell is open */
/*  work (audit 2026-10-05, item 3).                                          */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ParagraphSheet from "./ParagraphSheet";
import { forgetParagraphSheetData } from "./paragraphSheetData";
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
  weakCoachRequest: {
    // A problem fired and nothing in the library matched: the backend names
    // the coach request (`openCard`), and no rewrite rides the paragraph.
    decided: [moment({ bookmarkTier: "weak", openCard: "coach_request" } as Partial<DocumentSuggestion>)],
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
        practisable: () => true,
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

/* One case per cell of the matrix; Not sure is walked on every read so a
 * drift from No shows. */
const CASES: ReadonlyArray<[string, keyof typeof MOMENTS, Judgement, Expect]> = [
  ["read confident, In-between: praise with a Practise link, then the helper words", "confident", "in_between",
    { card: "praise", pill: "next", link: "practise", helperWords: true }],
  ["read confident, No: praise to practise or skip, no helper words (B2)", "confident", "no",
    { card: "praise", pill: "practise", link: "skip", helperWords: false }],
  ["Audio unclear: nothing, and no helper words", "confident", "audio_unclear",
    { card: null, pill: "next", link: null, helperWords: false }],
  ["read weak, Yes: no card, the helper words", "weakProblemFired", "yes",
    { card: null, pill: "next", link: null, helperWords: true }],
  ["read weak where a problem fired, No: the library video, even with a rewrite on the paragraph", "weakProblemFired", "no",
    { card: "exercise", pill: "practise", link: "skip", helperWords: false }],
  ["read weak where nothing fired, In-between: the rewrite; Keep my words goes on to the helper words (29b)", "weakNothingFired", "in_between",
    { card: "rewrite", pill: "accept", link: "keep", helperWords: true }],
  ["read weak where nothing fired, No: the rewrite; Keep my words practises the speaker's own words (29b)", "weakNothingFired", "no",
    { card: "rewrite", pill: "accept", link: "keep", helperWords: false }],
  ["read confident, Yes: praise, then the helper words", "confident", "yes",
    { card: "praise", pill: "next", link: null, helperWords: true }],
  ["read confident, Not sure: as No", "confident", "not_sure",
    { card: "praise", pill: "practise", link: "skip", helperWords: false }],
  ["read weak where a problem fired, Not sure: as No", "weakProblemFired", "not_sure",
    { card: "exercise", pill: "practise", link: "skip", helperWords: false }],
  ["read weak where nothing fired, Not sure: as No", "weakNothingFired", "not_sure",
    { card: "rewrite", pill: "accept", link: "keep", helperWords: false }],
  ["read weak, nothing in the library, No: the plain moment with the coach's line", "weakCoachRequest", "no",
    { card: "plain", pill: "practise", link: "skip", helperWords: false, coachLine: true }],
];

describe("what follows each judgement, by the machine's read (24f)", () => {
  it.each(CASES)("%s", async (_name, shape, answer, want) => {
    await expectWalk(shape, answer, want);
  });
});
