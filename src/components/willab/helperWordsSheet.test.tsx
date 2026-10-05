// @vitest-environment jsdom
/* THE HELPER WORDS OVERLAY (founder lock 2026-09-30, B4, B10, D4, D5, Q2,
   Q3): opened from the saved screen's "Edit" and from
   the page's headline; the current words with Delete on top, one chip per
   Take, that Take's words to tap, the button lit only when the selection
   differs; Delete asks once; one Take, one phrase. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HelperWordsSheet from "./HelperWordsSheet";
import OpenChunkSheet from "./OpenChunkSheet";
import { forgetParagraphSheetData } from "./paragraphSheetData";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { ParagraphHistory } from "@/services/api/bookmarkHistory";
import type { RootPhraseSpan } from "@/services/api/partLock";
import {
  changed,
  preselect,
  replaceNoteTake,
  savedTakeIndex,
  takeChips,
} from "@/lib/willab/helperWordsOverlay";
import { phraseTokens } from "@/lib/willab/phraseTokens";

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
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));
vi.mock("@/services/api/bookmarkHistory", () => ({
  fetchOwnerAnswers: vi.fn(async () => []),
  fetchParagraphHistory: vi.fn(async () => HISTORY),
}));

const TEXT = "The timing matters here: the window shuts as soon as the big players match our price.";
const TAKE1 = "We think the timing matters, because the window closes once the incumbents catch up with pricing.";

const HISTORY: ParagraphHistory = {
  slideIndex: 1,
  versions: [
    { takeIndex: 1, paragraphs: [TAKE1], at: "2026-09-01T10:00:00Z" },
    { takeIndex: 2, paragraphs: [TEXT], at: "2026-09-02T10:00:00Z" },
  ],
  helperWords: [{ phrases: ["the timing matters"], at: "2026-09-01T11:00:00Z" }],
  practice: [],
};

describe("the rules", () => {
  it("one chip per Take, newest first, the current one now with the paragraph as it is", () => {
    const chips = takeChips(HISTORY, TEXT, "Take");
    expect(chips.map((c) => [c.label, c.now])).toEqual([["Take 2", true], ["Take 1", false]]);
    expect(chips[0].text).toBe(TEXT);
    expect(chips[1].text).toBe(TAKE1);
    expect(takeChips(null, TEXT, "Take")).toEqual([{ takeIndex: null, label: "Take", now: true, text: TEXT }]);
  });

  it("the saved words come pre-selected when they sit in the text whole (B10)", () => {
    expect(preselect(phraseTokens(TEXT), "the timing matters")).toEqual({ from: 0, to: 2 });
    expect(preselect(phraseTokens(TAKE1), "the timing matters")).toEqual({ from: 2, to: 4 });
    expect(preselect(phraseTokens(TEXT), "window closes")).toBeNull();
    expect(preselect(phraseTokens(TEXT), null)).toBeNull();
  });

  it("the button lights only when the selection differs from the saved words", () => {
    expect(changed("the timing matters", "the timing matters")).toBe(false);
    expect(changed("window shuts", "the timing matters")).toBe(true);
    expect(changed(null, "the timing matters")).toBe(false);
    expect(changed("window shuts", null)).toBe(true);
  });

  it("knows which Take the saved words came from, for the signed line (B9)", () => {
    expect(savedTakeIndex(HISTORY)).toBe(1);
    const chips = takeChips(HISTORY, TEXT, "Take");
    expect(replaceNoteTake(HISTORY, "the timing matters", chips[0])).toBe(1);
    expect(replaceNoteTake(HISTORY, "the timing matters", chips[1])).toBeNull();
    expect(replaceNoteTake(HISTORY, null, chips[0])).toBeNull();
  });
});

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

const buttons = () => Array.from(container.querySelectorAll("button"));
const button = (label: string) =>
  buttons().find((b) => (b.textContent ?? "").trim() === label) as HTMLButtonElement | undefined;
const use = () => container.querySelector('[data-testid="helper-words-use"]') as HTMLButtonElement;
const card = () => container.querySelector('[data-testid="helper-words-card"]') as HTMLElement;
const tokens = () => Array.from(container.querySelectorAll('[data-testid="picker-tokens"] button'));
const word = (text: string, nth = 0) =>
  tokens().filter((t) => t.textContent === text)[nth] as HTMLButtonElement;

const useCurrent = vi.fn(async (_span: RootPhraseSpan) => true);
const useFromTake = vi.fn(async (_phrase: string, _takeIndex: number) => true);
const onDelete = vi.fn(async () => true);
const onDone = vi.fn();
const onClose = vi.fn();

async function renderSheet(headline: string | null = "the timing matters") {
  useCurrent.mockClear();
  useFromTake.mockClear();
  onDelete.mockClear();
  onDone.mockClear();
  onClose.mockClear();
  await act(async () => {
    root.render(
      createElement(HelperWordsSheet, {
        headline,
        currentText: TEXT,
        history: HISTORY,
        onUseCurrent: useCurrent,
        onUseFromTake: useFromTake,
        onDelete,
        onDone,
        onClose,
      }),
    );
  });
}

describe("the overlay", () => {
  it("opens on the current words with Delete, the Take chips and the current Take's words pre-selected; the button is off", async () => {
    await renderSheet();
    expect(container.querySelector("h2")?.textContent).toBe("Helper words");
    expect(card().textContent).toContain("the timing matters");
    expect(card().getAttribute("data-new")).toBeNull();
    expect(container.querySelector('[data-testid="helper-words-delete"]')).not.toBeNull();
    const chips = Array.from(container.querySelectorAll('[data-testid="take-chips"] button')).map((b) => b.textContent);
    expect(chips).toEqual(["Take 2 · now", "Take 1"]);
    expect(container.textContent).toContain("3 of 4 words");
    expect(tokens().filter((t) => t.getAttribute("aria-pressed") === "true").map((t) => t.textContent)).toEqual(["The", "timing", "matters"]);
    expect(use().disabled).toBe(true);
    // No playback on this overlay (B4).
    expect(container.querySelector("audio, video")).toBeNull();
  });

  it("tapping in the current Take updates the card live, marks it new, lights the button, and saves a span", async () => {
    await renderSheet();
    await act(async () => word("window").click());
    await act(async () => word("shuts").click());
    expect(card().getAttribute("data-new")).toBe("true");
    expect(card().textContent).toContain("Helper words · new");
    expect(card().textContent).toContain("window shuts");
    expect(use().disabled).toBe(false);
    await act(async () => use().click());
    expect(useCurrent).toHaveBeenCalledTimes(1);
    expect(useCurrent.mock.calls[0][0]).toMatchObject({ text: "window shuts" });
    expect(useFromTake).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("the Take 1 chip shows that Take's words; switching starts a fresh selection (Q3); its words go to the Slide (D5)", async () => {
    await renderSheet();
    await act(async () => button("Take 1")?.click());
    expect(container.textContent).toContain("incumbents");
    expect(container.textContent).toContain("0 of 4 words");
    expect(use().disabled).toBe(true);
    await act(async () => word("window").click());
    await act(async () => word("closes").click());
    expect(card().textContent).toContain("window closes");
    await act(async () => use().click());
    expect(useFromTake).toHaveBeenCalledWith("window closes", 1);
    expect(useCurrent).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("the signed line under the picker on a later Take says whose words these replace (B9)", async () => {
    await renderSheet();
    expect(container.querySelector('[data-testid="helper-words-replace-note"]')?.textContent).toBe(
      "These replace your Take 1 words. Those stay in Earlier Takes.",
    );
    await act(async () => button("Take 1")?.click());
    expect(container.querySelector('[data-testid="helper-words-replace-note"]')).toBeNull();
  });

  it("Delete asks once: the card clears and the button reads Delete helper words; a tap on a word keeps the words (Q2, D4)", async () => {
    await renderSheet();
    await act(async () => (container.querySelector('[data-testid="helper-words-delete"]') as HTMLButtonElement).click());
    expect(onDelete).not.toHaveBeenCalled();
    expect(card().textContent).not.toContain("the timing matters");
    const confirm = container.querySelector('[data-testid="helper-words-delete-confirm"]') as HTMLButtonElement;
    expect(confirm.textContent).toBe("Delete helper words");
    // Cancel: a word keeps the words.
    await act(async () => word("window").click());
    expect(container.querySelector('[data-testid="helper-words-delete-confirm"]')).toBeNull();
    expect(container.querySelector('[data-testid="helper-words-delete"]')).toBeNull(); // a new selection: the button, not Delete
    // Back to the saved words (a second tap clears the one word), then
    // Delete again, and through.
    await act(async () => word("window").click());
    expect(container.querySelector('[data-testid="helper-words-delete"]')).not.toBeNull();
    await act(async () => (container.querySelector('[data-testid="helper-words-delete"]') as HTMLButtonElement).click());
    await act(async () => (container.querySelector('[data-testid="helper-words-delete-confirm"]') as HTMLButtonElement).click());
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("four words at most, from whichever Take is open (B3)", async () => {
    await renderSheet(null);
    await act(async () => word("The").click());
    // From one word, a second tap that would make the run longer than four
    // cannot be reached; the fourth word can.
    expect(word("window").disabled).toBe(true);
    expect(word("here:").disabled).toBe(false);
    await act(async () => word("here:").click());
    expect(container.textContent).toContain("4 of 4 words");
  });
});

describe("from the saved screen and the page (B4)", () => {
  const moment = {
    id: "s-cv",
    start: 0,
    end: 18,
    quote: "The timing matters",
    kind: "advice",
    proposedText: null,
    device: null,
    status: "dismissed",
    feedbackFamily: "confident_voice",
    source: "confident_voice",
    snippetId: "snip-1",
    takeSessionId: "take-2",
  } as unknown as DocumentSuggestion;
  const state = () =>
    chunkStateFor(
      {
        part: { id: "p1", text: TEXT, locked: true },
        paragraphIndex: 0,
        start: 0,
        end: TEXT.length,
        status: "locked",
        pendingIds: [],
        approvedIds: [],
        decidedIds: [moment.id],
      } as DeckChunk,
      { document: TEXT, suggestions: [moment] },
    );
  const host = { onUseFromTake: useFromTake, onDelete };
  const render = (startPicking: boolean) =>
    act(async () => {
      root.render(
        createElement(OpenChunkSheet, {
          state: state(),
          arcId: "arc-1",
          takeSessionId: "take-2",
          headline: "the timing matters",
          onUseHelperWords: useCurrent,
          helperWordsHost: host,
          startPicking,
          onDone,
          onClose,
          renderSheet: () => null,
        }),
      );
    });

  it("Edit on the saved screen opens the overlay", async () => {
    await render(false);
    expect(container.querySelector('[data-testid="overlay-saved"]')).not.toBeNull();
    // "Edit", the mock's word (N48.3 Q8 A).
    expect(container.querySelector('[data-testid="paragraph-helper-words"]')?.textContent).toBe("Edit");
    await act(async () => (container.querySelector('[data-testid="paragraph-helper-words"]') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="helper-words-sheet"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="take-chips"]')?.textContent).toContain("Take 1");
  });

  it("the page's headline opens straight on the overlay", async () => {
    await render(true);
    expect(container.querySelector('[data-testid="helper-words-sheet"]')).not.toBeNull();
  });
});
