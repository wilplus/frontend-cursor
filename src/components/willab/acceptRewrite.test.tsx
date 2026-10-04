// @vitest-environment jsdom
/* AN ACCEPTED REWRITE IS A PARAGRAPH VERSION (F1 Repair Plan Phase 4, P1-1;
   contract 29b). The server writes the words from the V3 freeze and says
   what it did in `text_update`: written, the page is told so and sends no
   ledger decision of its own; refused, the sheet says the accept was not
   saved and nothing changes. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenChunkSheet, { asJudgement } from "./OpenChunkSheet";
import DeckChunkModal from "./DeckChunkModal";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import { fetchOwnerAnswers } from "@/services/api/bookmarkHistory";
import { forgetParagraphSheetData } from "./paragraphSheetData";
import { readPractiseOffered } from "@/services/api/consentChoices";
import { saveTakeFeedbackResponse } from "@/services/api/takeFeedback";

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
vi.mock("@/services/api/mlc3FirstClient", async (load) => {
  const actual = await load<typeof import("@/services/api/mlc3FirstClient")>();
  return { ...actual, mlc3FirstClientPresentationEnabled: false };
});
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

function state() {
  return chunkStateFor(
    {
      part: { id: "p1", text: TEXT, locked: false },
      paragraphIndex: 0,
      start: 0,
      end: TEXT.length,
      status: "clean",
      pendingIds: [],
      approvedIds: [],
      decidedIds: [answered.id],
    } as DeckChunk,
    { document: TEXT, suggestions: [answered] },
  );
}

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
const onAccept = vi.fn(async (_item: DocumentSuggestion) => true);
type SheetProps = Parameters<typeof OpenChunkSheet>[0];

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
        practiseHost: { onLockIn: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })), onHelperWordsSaved: vi.fn() },
        renderSheet: (practiseAgain: Parameters<SheetProps["renderSheet"]>[0]) =>
          createElement(DeckChunkModal, {
            state: s,
            practiseAgain,
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


async function accept(textUpdate: string | undefined) {
  onAccept.mockClear();
  vi.mocked(saveTakeFeedbackResponse).mockResolvedValueOnce(
    textUpdate === undefined ? { ok: true } : { ok: true, textUpdate });
  await open("no", { practiceExercise: null } as unknown as Partial<DocumentSuggestion>, [
    { ...rewrite, takeSessionId: "take-1", feedbackFamily: "rewrite_clarity" } as DocumentSuggestion,
  ]);
  const button = container.querySelector('[data-testid="paragraph-sheet-accept"]') as HTMLButtonElement;
  expect(button).not.toBeNull();
  await act(async () => button.click());
}

describe("accepting a rewrite", () => {
  it("the server wrote it: the page is told and refreshes", async () => {
    await accept("applied");
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept.mock.calls[0][0].acceptedOnServer).toBe(true);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("the server refused: nothing changes and the sheet says so", async () => {
    await accept("protected");
    expect(onAccept).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("an older backend: the page decides as before", async () => {
    await accept(undefined);
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept.mock.calls[0][0].acceptedOnServer).toBeUndefined();
  });
});
