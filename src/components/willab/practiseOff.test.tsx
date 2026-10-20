// @vitest-environment jsdom
/*
 * STORY    As a speaker who turned personalised practice off, I want no
 *          Practise or "Accept and practise" offered, so that I never record
 *          an attempt the server will refuse.
 * OUTCOME
 *   O1  Choice off, a Not sure on a moment with an exercise: the footer is
 *       Next, with no Practise and no Skip.
 *   O2  Choice off, a No on a moment with a clearer version: no "Accept and
 *       practise" and no Practise; Next is there.
 *   O3  Control: with the choice on, that same clearer version does offer
 *       "Accept and practise" (so O2 cannot pass on a sheet that never offers it).
 * PROVES   O1 -> "a Not sure offers Next, never Practise or Skip"
 *          O2, O3 -> "a clearer version offers no Accept and practise (and does with the choice on)"
 * WHY      F1 Repair Plan Phase 4: every practice route answers 403 CONSENT_CHOICE_OFF.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenChunkSheet from "./OpenChunkSheet";
import DeckChunkModal from "./DeckChunkModal";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import { fetchOwnerAnswers } from "@/services/api/bookmarkHistory";
import { forgetParagraphSheetData } from "./paragraphSheetData";

const choice = vi.hoisted(() => ({ offered: false }));
vi.mock("@/services/api/consentChoices", () => ({
  practiseOfferedNow: vi.fn(() => choice.offered),
  readPractiseOffered: vi.fn(async () => choice.offered),
}));

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
  fetchOwnerAnswers: vi.fn(async () => [
    { feedbackId: "s-cv", response: "not_sure" },
  ]),
  fetchParagraphHistory: vi.fn(async () => ({
    slideIndex: 0,
    versions: [
      { takeIndex: 1, paragraphs: ["We ship it."], at: null },
      { takeIndex: 2, paragraphs: [TEXT], at: null },
    ],
    helperWords: [{ phrases: ["ship it now"], at: null }],
    practice: [],
  })),
}));

const TEXT = "We should ship it now because the data is clear.";

const answered = {
  id: "s-cv",
  start: 0,
  end: 21,
  quote: "We should ship it now",
  kind: "advice",
  proposedText: null,
  device: null,
  status: "dismissed",
  feedbackFamily: "confident_voice",
  source: "confident_voice",
  snippetId: "snip-1",
  takeSessionId: "take-1",
  practiceExercise: { id: "ex-1", instruction: "Say it again, slower." },
  evidence: {
    projectId: "arc-1",
    takeSessionId: "take-1",
    slideIndex: 0,
    paragraphIndex: 0,
    start: 0,
    end: 21,
  },
} as unknown as DocumentSuggestion;

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  choice.offered = false;
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function open(
  answer: string,
  over: Partial<DocumentSuggestion> = {},
  open: DocumentSuggestion[] = [],
) {
  vi.mocked(fetchOwnerAnswers).mockResolvedValue([{ feedbackId: "s-cv", response: answer }]);
  forgetParagraphSheetData();
  const item = { ...answered, ...over } as DocumentSuggestion;
  const s = chunkStateFor(
    {
      part: { id: "p1", text: TEXT, locked: false },
      paragraphIndex: 0,
      start: 0,
      end: TEXT.length,
      status: "clean",
      pendingIds: open.map((o) => o.id),
      approvedIds: [],
      decidedIds: [item.id],
    } as DeckChunk,
    { document: TEXT, suggestions: [item, ...open] },
  );
  await act(async () => {
    root.render(
      createElement(OpenChunkSheet, {
        state: s,
        arcId: "arc-1",
        takeSessionId: "take-1",
        headline: null,
        onUseHelperWords: vi.fn(async () => true),
        onAccept: vi.fn(async () => true),
        onClose: vi.fn(),
        onPractise: vi.fn(() => true),
        renderSheet: () =>
          createElement(DeckChunkModal, {
            state: s,
            onAccept: vi.fn(async () => true),
            onKeepMine: vi.fn(async () => true),
            onLockIn: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
            onSetRootPhrase: vi.fn(async () => true),
            onClose: vi.fn(),
          }),
      } as unknown as Parameters<typeof OpenChunkSheet>[0]),
    );
  });
}

const testIds = () =>
  Array.from(container.querySelectorAll("[data-testid^='paragraph-sheet-']"))
    .map((el) => el.getAttribute("data-testid"));

describe("Personalised practice off", () => {

  it("a Not sure offers Next, never Practise or Skip", async () => {
    await open("not_sure");
    expect(testIds()).toContain("paragraph-sheet-next");
    expect(testIds()).not.toContain("paragraph-sheet-practise");
    expect(testIds()).not.toContain("paragraph-sheet-skip");
  });

  /** A clearer version of the same words, still waiting. */
  const rewrite = {
    id: "s-rw",
    start: 0,
    end: 21,
    quote: "We should ship it now",
    kind: "replace",
    proposedText: "Ship it now",
    feedbackFamily: "rewrite_clarity",
    source: "manager",
    device: null,
    status: null,
  } as unknown as DocumentSuggestion;

  it("a clearer version offers no Accept and practise (and does with the choice on)", async () => {
    choice.offered = true;
    await open("no", { practiceExercise: null }, [rewrite]);
    expect(testIds()).toContain("paragraph-sheet-accept");
    await act(async () => root.unmount());
    root = createRoot(container);

    choice.offered = false;
    await open("no", { practiceExercise: null }, [rewrite]);
    expect(testIds()).toContain("paragraph-sheet-next");
    expect(testIds()).not.toContain("paragraph-sheet-accept");
    expect(testIds()).not.toContain("paragraph-sheet-practise");
    expect(container.textContent).not.toContain("Accept and practise");
  });
});
