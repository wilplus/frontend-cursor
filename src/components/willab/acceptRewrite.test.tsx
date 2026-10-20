// @vitest-environment jsdom
/*
STORY    As a speaker accepting a clearer version in the paragraph sheet, I
         want my answer saved and my text unchanged until I say it in my next
         Take, so that the Ideal Text is only what I said.
OUTCOME
  O1  The answer is saved once, as apply_suggestion.
  O2  Never-5: the host's real accept lane (postTrackedDecision) sends no
      decision, suggestion-feedback or other request that could change a
      word of the paragraph.
  O3  The practise goes on, with the accepted words to say.
PROVES   O1, O2, O3 -> "records the answer, changes no word, and goes on to the practise"
WHY      Never-5 (founder lock 2026-10-12). The walk's own accept lane and the
         deck text after it are in deckFeedbackWalk.test.tsx.
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
import { saveTakeFeedbackResponse } from "@/services/api/takeFeedback";
import { postTrackedDecision, type DecisionApi } from "@/lib/willab/idealTextDecisions";

vi.mock("@/services/api/consentChoices", () => ({
  practiseOfferedNow: vi.fn(() => null),
  readPractiseOffered: vi.fn(async () => true),
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
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const closeSheet = vi.fn();
/** The decision lane the deck's hosts route an accept through, with every
 *  server call it could make counted. */
const decisionApi = {
  decideBlock: vi.fn(),
  decidePriorTake: vi.fn(),
  sendSuggestionFeedback: vi.fn(async () => ({ saved: true })),
};
const onAccept = vi.fn(async (item: DocumentSuggestion) =>
  (await postTrackedDecision("arc-1", item, "accept", decisionApi as unknown as DecisionApi)) === "ok",
);
const onPractise = vi.fn((_partId: string, _card: unknown, _moment: unknown) => true);

const rewrite = {
  id: "s-rw",
  start: 0,
  end: 21,
  quote: "We should ship it now",
  kind: "replace",
  source: "wording",
  feedbackFamily: "rewrite_clarity",
  proposedText: "We ship it now.",
  status: "pending",
  snippetId: "snip-1",
  takeSessionId: "take-1",
} as unknown as DocumentSuggestion;

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
        onAccept,
        onClose: closeSheet,
        onPractise,
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


async function accept() {
  onAccept.mockClear();
  onPractise.mockClear();
  vi.mocked(saveTakeFeedbackResponse).mockClear();
  vi.mocked(saveTakeFeedbackResponse).mockResolvedValueOnce(
    { ok: true });
  await open("no", { practiceExercise: null } as unknown as Partial<DocumentSuggestion>, [
    { ...rewrite, takeSessionId: "take-1", feedbackFamily: "rewrite_clarity" } as DocumentSuggestion,
  ]);
  const button = container.querySelector('[data-testid="paragraph-sheet-accept"]') as HTMLButtonElement;
  expect(button).not.toBeNull();
  await act(async () => button.click());
}

describe("accepting a rewrite", () => {
  it("records the answer, changes no word, and goes on to the practise", async () => {
    const network = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", network);
    try {
      await accept();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(saveTakeFeedbackResponse).toHaveBeenCalledTimes(1);
    expect(saveTakeFeedbackResponse).toHaveBeenCalledWith(
      expect.objectContaining({ feedbackId: "s-rw", response: "apply_suggestion" }),
    );
    expect(onAccept).toHaveBeenCalledTimes(1);
    await expect(onAccept.mock.results[0].value).resolves.toBe(true);
    expect(decisionApi.decideBlock).not.toHaveBeenCalled();
    expect(decisionApi.decidePriorTake).not.toHaveBeenCalled();
    expect(decisionApi.sendSuggestionFeedback).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
    expect(onPractise).toHaveBeenCalledTimes(1);
    expect(onPractise.mock.calls[0][1]).toEqual(
      expect.objectContaining({ kind: "rewrite", text: "We ship it now." }),
    );
  });
});
