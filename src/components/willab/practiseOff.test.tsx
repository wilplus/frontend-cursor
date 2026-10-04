// @vitest-environment jsdom
/* PERSONALISED PRACTICE OFF (F1 Repair Plan Phase 4, wiring only): every
   practice route answers 403 CONSENT_CHOICE_OFF, and the speaker used to
   record a whole attempt before hearing so. With the choice off the
   paragraph sheet offers no Practise -- and so no "Accept and practise",
   whose one button promises the practise -- and its footer is Next. */
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

vi.mock("@/services/api/consentChoices", () => ({
  practiseOfferedNow: vi.fn(() => null),
  readPractiseOffered: vi.fn(async () => false),
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
vi.mock("@/services/api/takeFeedback", () => ({
  saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })),
}));
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
        onAccept: vi.fn(async () => true),
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

const testIds = () =>
  Array.from(container.querySelectorAll("[data-testid^='paragraph-sheet-']"))
    .map((el) => el.getAttribute("data-testid"));

describe("Personalised practice off", () => {
  it("reads the choice", async () => {
    await open("not_sure");
    expect(readPractiseOffered).toHaveBeenCalled();
  });

  it("a Not sure offers Next, never Practise or Skip", async () => {
    await open("not_sure");
    expect(testIds()).toContain("paragraph-sheet-next");
    expect(testIds()).not.toContain("paragraph-sheet-practise");
    expect(testIds()).not.toContain("paragraph-sheet-skip");
  });

  it("an In-between offers Next with no Practise link", async () => {
    await open("in_between");
    expect(testIds()).toContain("paragraph-sheet-next");
    expect(testIds()).not.toContain("paragraph-sheet-practise");
  });

  it("a rewrite is not offered as Accept and practise", async () => {
    await open("no", { practiceExercise: null } as unknown as Partial<DocumentSuggestion>, [rewrite]);
    expect(testIds()).not.toContain("paragraph-sheet-accept");
    expect(testIds()).not.toContain("paragraph-sheet-practise");
    expect(testIds()).toContain("paragraph-sheet-next");
  });
});

describe("control: with the choice on", () => {
  it("the same rewrite is offered as Accept and practise", async () => {
    vi.mocked(readPractiseOffered).mockResolvedValueOnce(true);
    await open("no", { practiceExercise: null } as unknown as Partial<DocumentSuggestion>, [rewrite]);
    expect(testIds()).toContain("paragraph-sheet-accept");
  });
});
