// @vitest-environment jsdom
/* The paragraph sheet's saved state (build plan D-IT-3):
   - the words card reads "Helper words" with an outlined "Edit" chip at its
     top right, the words under them (the helper-words build list, task 4
     mock "Entry");
   - on a project with two or more Takes it draws no player, even when the
     moment carries a clip (D6 amended, N48.1); Take 1 still plays it. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenChunkSheet from "./OpenChunkSheet";
import { savedStateShowsPlayer } from "./ParagraphSheet";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";

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
const player = () => saved()?.querySelector('[data-testid="media-player"]') ?? null;

describe("the saved state's player (D6 amended, N48.1)", () => {
  it("is a rule: Take 1 plays the moment, a later Take does not", () => {
    expect(savedStateShowsPlayer(true)).toBe(true);
    expect(savedStateShowsPlayer(false)).toBe(false);
  });

  it("draws no player on a project with two or more Takes, clip or not", async () => {
    await render(false);
    expect(saved()).not.toBeNull();
    expect(player()).toBeNull();
    // Everything else on the screen is still there.
    expect(saved()?.textContent).toContain("ship it now");
    expect(container.querySelector('[data-testid="paragraph-history"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="paragraph-sheet-next"]')?.textContent).toBe("Next");
  });

  it("still plays the moment on Take 1", async () => {
    await render(true);
    expect(player()?.getAttribute("data-src")).toBe("https://media.example/moment.wav");
  });
});

describe("the words card (helper-words build list, task 4 mock)", () => {
  it("reads Helper words with an outlined Edit chip at its top right, the words under them", async () => {
    await render(false);
    const card = container.querySelector('[data-testid="paragraph-helper-card"]')!;
    const top = card.firstElementChild!;
    expect(top.className).toMatch(/justify-between/);
    const [label, chip] = Array.from(top.children);
    expect(label.textContent).toBe("Helper words");
    expect(chip.getAttribute("data-testid")).toBe("paragraph-helper-words");
    expect(chip.textContent).toBe("Edit");
    expect(chip.className.split(" ")).toEqual(
      expect.arrayContaining(["rounded-full", "border", "text-primary"]),
    );
    // The words come after the label row.
    expect(top.nextElementSibling?.textContent).toBe("ship it now");
  });
});
