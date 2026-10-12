// @vitest-environment jsdom
/* The paragraph overlay (founder lock 2026-09-30, B5, B8, D6, D7, Q1): two
   states, the practise state and the saved state, never the paragraph
   text, in the Feedback walk's look; Practise opens the walk's practise
   screens on the card shown (founder 2026-10-10), and an answer in the
   judgement sheet hands the paragraph to its own sheet. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenChunkSheet from "./OpenChunkSheet";
import DeckChunkModal from "./DeckChunkModal";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import { fetchOwnerAnswers } from "@/services/api/bookmarkHistory";
import { forgetParagraphSheetData } from "./paragraphSheetData";

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

const useWords = vi.fn(async (_span: { text: string }) => true);
/** The deck's door to the Feedback walk's practise (practisePart). */
const practise = vi.fn((_partId: string, _card: unknown, _moment: unknown) => true);
const closeSheet = vi.fn();

function render(s = state()) {
  return act(async () => {
    root.render(
      createElement(OpenChunkSheet, {
        state: s,
        arcId: "arc-1",
        takeSessionId: "take-1",
        headline: "ship it now",
        onUseHelperWords: useWords,
        onClose: closeSheet,
        renderSheet: () =>
          createElement(DeckChunkModal, {
            state: s,
            onAccept: vi.fn(async () => true),
            onKeepMine: vi.fn(async () => true),
            onLockIn: vi.fn(async () => ({
              outcome: "ok" as const,
              rootPhraseProposal: null,
            })),
            onSetRootPhrase: vi.fn(async () => true),
            onClose: vi.fn(),
          }),
      }),
    );
  });
}

describe("the paragraph overlay, saved state (founder lock 2026-09-30, B8, D6)", () => {
  it("shows the helper words and History, never the paragraph text, and one black button", async () => {
    await render(); // the fixture's headline is "ship it now"
    const sheet = container.querySelector('[data-testid="paragraph-sheet"]');
    expect(sheet).not.toBeNull();
    expect(sheet?.querySelector("h2")?.textContent).toBe("Helper words saved");
    const saved = container.querySelector('[data-testid="overlay-saved"]');
    expect(saved).not.toBeNull();
    const helper = container.querySelector('[data-testid="paragraph-helper-card"]')?.textContent ?? "";
    expect(helper).toContain("Helper words");
    expect(helper).toContain("ship it now");
    // No judgement, no practise card (B8), no paragraph text (D6).
    expect(container.querySelector('[data-testid="judgement-label"]')).toBeNull();
    expect(container.querySelector('[data-testid="practise-card"]')).toBeNull();
    expect(sheet?.textContent).not.toContain(TEXT);
    // One collapsed History row (Q1), earlier Takes as single rows.
    const history = container.querySelector('[data-testid="paragraph-history"]');
    expect(history?.textContent).toContain("History");
    expect(history?.textContent).toContain("Take 1");
    expect(history?.textContent).not.toContain("Take 2");
    expect(sheet?.textContent).not.toMatch(/\d+\s*%|\bscore\b/i);
    // Outside the walk the one black button reads Next too (N48.3 Q8 A, D10).
    const next = sheet?.querySelector('[data-testid="paragraph-sheet-next"]') as HTMLButtonElement;
    expect(next.textContent).toBe("Next");
    await act(async () => next.click());
    expect(closeSheet).toHaveBeenCalled();
  });
});

describe("the paragraph overlay, practise state (founder lock 2026-09-30, B5, D1, D7)", () => {
  const renderOpen = (answer: string, over: Partial<DocumentSuggestion> = {}) =>
    act(async () => {
      const item = { ...answered, ...over } as DocumentSuggestion;
      const s = chunkStateFor(
        {
          part: { id: "p1", text: TEXT, locked: false },
          paragraphIndex: 0,
          start: 0,
          end: TEXT.length,
          status: "clean",
          pendingIds: [],
          approvedIds: [],
          decidedIds: [item.id],
        } as DeckChunk,
        { document: TEXT, suggestions: [item] },
      );
      root.render(
        createElement(OpenChunkSheet, {
          state: s,
          arcId: "arc-1",
          takeSessionId: "take-1",
          headline: null,
          onUseHelperWords: useWords,
          onClose: closeSheet,
          onPractise: practise,
          renderSheet: () =>
            createElement(DeckChunkModal, {
              state: s,
              onAccept: vi.fn(async () => true),
              onKeepMine: vi.fn(async () => true),
              onLockIn: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
              onSetRootPhrase: vi.fn(async () => true),
              onClose: vi.fn(),
            }),
        }),
      );
    });
  const withAnswer = async (answer: string, over: Partial<DocumentSuggestion> = {}) => {
    vi.mocked(fetchOwnerAnswers).mockResolvedValue([{ feedbackId: "s-cv", response: answer }]);
    forgetParagraphSheetData();
    await renderOpen(answer, over);
  };
  // The screen on show: the walk's frame keeps a copy of the screen it
  // replaces while that one leaves (data-walk-ghost).
  const labels = () =>
    Array.from(container.querySelectorAll("button"))
      .filter((b) => !b.closest("[data-walk-ghost]"))
      .map((b) => b.textContent?.trim());

  it("Practise opens the Feedback walk's practise on the card shown", async () => {
    practise.mockClear();
    await withAnswer("no");
    const button = container.querySelector('[data-testid="paragraph-sheet-practise"]') as HTMLButtonElement;
    await act(async () => button.click());
    expect(practise).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ kind: "exercise" }),
      expect.objectContaining({ id: "s-cv" }),
    );
    // No judgement sheet and no old practise screen.
    expect(container.querySelector('[data-testid="practice-offer"]')).toBeNull();
    expect(container.querySelector('[data-testid="practise-sheet"]')).toBeNull();
  });
});
