// @vitest-environment jsdom
/*
 * STORY    As a speaker, I want the saved paragraph sheet to show my "Helper
 *          words" with an Edit chip, and the moment's clip only on Take 1, so
 *          that the sheet stays about my current words.
 * OUTCOME
 *   O1  Take 2+: no player, even when the moment carries a clip; the rest of
 *       the sheet is still there.
 *   O2  Take 1: the player plays the moment's clip.
 *   O3  The card reads "Helper words" with an Edit chip, my words under it.
 * PROVES   O1 -> "draws no player on a project with two or more Takes, clip or not"
 *          O2 -> "plays the moment's clip on Take 1"
 *          O3 -> "reads Helper words with an Edit chip and the words"
 * WHY      Build plan D-IT-3; D6 amended (founder 2026-10-05, N48.1).
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenChunkSheet from "./OpenChunkSheet";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import { CHUNK_SHEET_COPY } from "./idealEditCopy";

vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({
  default: ({ src }: { src: string }) =>
    createElement("div", { "data-testid": "media-player", "data-src": src }),
}));
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));
vi.mock("@/services/api/bookmarkHistory", () => ({
  fetchOwnerAnswers: vi.fn(async () => [{ feedbackId: "s-cv", response: "yes" }]),
  fetchParagraphHistory: vi.fn(async () => ({
    slideIndex: 0,
    versions: [{ takeIndex: 1, paragraphs: [TEXT], at: null }],
    helperWords: [{ phrases: ["ship it now"], at: null }],
    practice: [],
  })),
}));

const TEXT = "We should ship it now because the data is clear.";

/** A Confident Voice moment WITH a clip: the player has something to play. */
const moment = {
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
  snippetAudioRef: "https://media.example/moment.wav",
  startOffsetMs: 0,
  durationMs: 9000,
} as unknown as DocumentSuggestion;

function state() {
  return chunkStateFor(
    {
      part: { id: "p1", text: TEXT, locked: true },
      paragraphIndex: 0,
      start: 0,
      end: TEXT.length,
      status: "clean",
      pendingIds: [],
      approvedIds: [],
      decidedIds: [moment.id],
    } as DeckChunk,
    { document: TEXT, suggestions: [moment] },
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

function render(firstTake: boolean) {
  return act(async () => {
    root.render(
      createElement(OpenChunkSheet, {
        state: state(),
        arcId: "arc-1",
        takeSessionId: "take-1",
        headline: "ship it now",
        onUseHelperWords: vi.fn(async () => true),
        firstTake,
        onClose: vi.fn(),
        renderSheet: () => null,
      }),
    );
  });
}

const saved = () => container.querySelector('[data-testid="overlay-saved"]');
// The walk's one player (Q-WALK-PARA A).
const player = () => saved()?.querySelector("[data-walk-player]") ?? null;

describe("the saved state's player (D6 amended, N48.1)", () => {

  it("draws no player on a project with two or more Takes, clip or not", async () => {
    await render(false);
    expect(saved()).not.toBeNull();
    expect(player()).toBeNull();
    // Everything else on the screen is still there.
    expect(saved()?.textContent).toContain("ship it now");
    expect(container.querySelector('[data-testid="paragraph-history"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="paragraph-sheet-next"]')?.textContent).toBe("Next");
  });

  it("plays the moment's clip on Take 1", async () => {
    await render(true);
    expect(player()).not.toBeNull();
    expect(player()?.querySelector("audio")?.getAttribute("src")).toBe("https://media.example/moment.wav");
  });
});

describe("the saved state's words card (D-IT-3)", () => {
  it("reads Helper words with an Edit chip and the words", async () => {
    await render(false);
    const card = container.querySelector('[data-testid="paragraph-helper-card"]');
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain(CHUNK_SHEET_COPY.historyHelperWords);
    expect(card?.textContent).toContain("ship it now");
    expect(card?.querySelector('[data-testid="paragraph-helper-words"]')?.textContent).toBe(CHUNK_SHEET_COPY.pillChooseWords);
  });
});
