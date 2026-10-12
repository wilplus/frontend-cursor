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
import { forgetParagraphSheetData } from "./paragraphSheetData";
import type { ParagraphHistory } from "@/services/api/bookmarkHistory";
import type { RootPhraseSpan } from "@/services/api/partLock";

vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({
  default: () => createElement("div"),
}));
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

  it("tapping in the current Take updates the card live, marks it new, lights the button, and saves a span", async () => {
    await renderSheet(null);
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

  it("four words at most, from whichever Take is open (B3)", async () => {
    await renderSheet(null);
    // One tap, one word, next to the others (QA4 A, Q-B5 A): four taps make
    // four words; a word the run cannot reach in one step is greyed.
    await act(async () => word("The").click());
    expect(word("window").disabled).toBe(true);
    expect(word("timing").disabled).toBe(false);
    await act(async () => word("timing").click());
    await act(async () => word("matters").click());
    await act(async () => word("here:").click());
    expect(container.textContent).toContain("4 of 4 words");
    // The fifth word cannot be reached.
    expect(word("the").disabled).toBe(true);
  });
});
