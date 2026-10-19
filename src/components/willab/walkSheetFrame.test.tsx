// @vitest-environment jsdom
/*
 * STORY    As a speaker, I want feedback sheets to use the compact "Play this
 *          moment" row and draw their frame at once on tap, so that sheets
 *          feel stable and quick.
 * OUTCOME
 *   O1  The Suggestion screen plays my moment in the compact row, not the
 *       full player.
 *   O2  A tapped paragraph's sheet draws its frame and saved helper words
 *       before its reads land, and never the paragraph text (D6).
 * PROVES   O1 -> "plays the moment in the compact row on Suggestion"
 *          O2 -> "draws the frame with the helper words, and never the paragraph text (D6)"
 * WHY      Audit of 2026-09-29 against Ideal Text Final Screens. The one
 *          sheet height is layout and is not tested here.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ParagraphSheet from "./ParagraphSheet";
import DeckChunkModal from "./DeckChunkModal";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import { forgetParagraphSheetData } from "./paragraphSheetData";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { RootPhraseSpan } from "@/services/api/partLock";
import type { BehindOutcome } from "./saveBehind";
import { fetchParagraphHistory } from "@/services/api/bookmarkHistory";

vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/hooks/useExerciseRenderedAck", () => ({
  useExerciseRenderedAck: () => undefined,
}));
// The player records whether it was asked for the compact row.
vi.mock("@/components/results/MediaPlayer", () => ({
  default: (props: { compact?: boolean }) =>
    createElement("div", { "data-testid": "media-player", "data-compact": String(props.compact === true) }),
}));
vi.mock("@/services/api/takeFeedback", async (load) => {
  const actual = await load<typeof import("@/services/api/takeFeedback")>();
  return { ...actual, saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })) };
});
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));
vi.mock("@/services/api/bookmarkHistory", () => ({
  fetchOwnerAnswers: vi.fn(async () => []),
  fetchParagraphHistory: vi.fn(async () => null),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEXT =
  "We should ship it now because the data is clear and the team is ready.";

function suggestion(over: Partial<DocumentSuggestion>): DocumentSuggestion {
  return {
    id: "s-base",
    start: 0,
    end: 22,
    quote: "We should ship it now",
    kind: "advice",
    proposedText: null,
    device: null,
    ...over,
  } as DocumentSuggestion;
}

const confidentVoice = suggestion({
  id: "s-cv",
  feedbackFamily: "confident_voice",
  source: "confident_voice",
  snippetId: "snip-1",
  takeSessionId: "take-1",
  snippetAudioRef: "https://media/moment.wav",
  startOffsetMs: 0,
  durationMs: 9000,
  practiceExercise: {
    id: "ex-1",
    instruction: "Say it again, slower.",
    explanationVideoRef: "https://media/coach-exercise.mp4",
  },
  evidence: {
    projectId: "arc-1",
    takeSessionId: "take-1",
    slideIndex: 0,
    paragraphIndex: 0,
    start: 0,
    end: 22,
  },
} as unknown as Partial<DocumentSuggestion>);

const props = {
  onAccept: vi.fn(async () => true),
  onKeepMine: vi.fn(async () => true),
  onJudged: vi.fn(),
  onLockIn: vi.fn(async (_text: string) => ({
    outcome: "ok" as const,
    rootPhraseProposal: null,
  })),
  onSetRootPhrase: vi.fn(async (_phrase: RootPhraseSpan | null) => true),
  onClose: vi.fn(),
  saveBehind: vi.fn((task: () => Promise<BehindOutcome>) => {
    void task();
  }),
};

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  forgetParagraphSheetData();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("the compact moment row", () => {
  it("plays the moment in the compact row on Suggestion", async () => {
    const rewrite = suggestion({
      id: "s-rw",
      kind: "replace",
      feedbackFamily: "rewrite_clarity",
      proposedText: "Ship it now.",
      snippetAudioRef: "https://media/moment.wav",
      startOffsetMs: 0,
      durationMs: 9000,
    } as Partial<DocumentSuggestion>);
    const state = chunkStateFor(
      {
        part: { id: "p1", text: TEXT, locked: false },
        paragraphIndex: 0,
        start: 0,
        end: TEXT.length,
        status: "waiting",
        pendingIds: [rewrite.id],
        approvedIds: [],
      } as DeckChunk,
      { document: TEXT, suggestions: [rewrite] },
    );
    await act(async () => {
      root.render(createElement(DeckChunkModal, { ...props, state }));
    });
    const players = Array.from(container.querySelectorAll('[data-testid="media-player"]'));
    expect(players.length).toBeGreaterThan(0);
    expect(players.every((p) => p.getAttribute("data-compact") === "true")).toBe(true);
  });
});

describe("the paragraph sheet while its reads are pending", () => {
  it("draws the frame with the helper words, and never the paragraph text (D6)", async () => {
    vi.mocked(fetchParagraphHistory).mockReturnValueOnce(new Promise(() => undefined) as never);
    const decided = suggestion({
      ...confidentVoice,
      id: "s-done",
      status: "dismissed",
    } as Partial<DocumentSuggestion>);
    await act(async () => {
      root.render(
        createElement(ParagraphSheet, {
          arcId: "arc-1",
          takeSessionId: "take-1",
          partId: "p-pending",
          text: TEXT,
          headline: "ship it now",
          decided: [decided],
          onClose: () => undefined,
        }),
      );
    });
    const frame = container.querySelector('[data-testid="paragraph-sheet"]');
    expect(frame).not.toBeNull();
    // Saved helper words: the saved state, drawn at once with what it has.
    const saved = container.querySelector('[data-testid="overlay-saved"]');
    expect(saved).not.toBeNull();
    expect(saved?.textContent).toContain("ship it now");
    expect(frame?.textContent).not.toContain(TEXT);
  });
});
