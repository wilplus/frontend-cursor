// @vitest-environment jsdom
/*
STORY    As a speaker, I want to pick up to eight helper words from any Take,
         delete them with one confirm, and save only when changed, so that my
         helper words stay until I pick new ones.
OUTCOME
  O1  Tapping words in the current Take updates the card live, marks it new,
      and saves them as a span of the paragraph.
  O2  Eight words at most, saved in the order said.
  O3  One chip per Take, newest first, the current one "now"; words from an
      earlier Take save with that Take's number.
  O4  Delete asks once: the first tap only clears the card, the second deletes.
  O5  Never 5 (helper words stay until the speaker picks new ones): the button
      is lit only when the selection differs from the saved words, so the
      saved words cannot be overwritten by an unchanged tap.
PROVES   O1 -> "tapping in the current Take updates the card live ..."
         O2 -> "eight words at most ..."
         O3 -> "one chip per Take; an earlier Take's words save with its number"
         O4 -> "Delete asks once, then deletes"
         O5 -> "the button lights only when the words differ from the saved ones"
WHY      Founder lock 2026-09-30 (B4, B10, D4, D5, Q2, Q3).
*/
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

const chips = () => Array.from(container.querySelectorAll('[data-testid="take-chips"] button'));
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

  it("eight words at most, any words, read in the order said (founder 2026-10-15)", async () => {
    await renderSheet(null);
    // Tapped out of order and apart; saved in the order said, pieces apart.
    await act(async () => word("price.").click());
    await act(async () => word("timing").click());
    await act(async () => word("matters").click());
    expect(card().textContent).toContain("timing matters · price");
    for (const w of ["The", "here:", "window", "shuts", "big"]) {
      await act(async () => word(w).click());
    }
    // Eight are picked; a ninth cannot be.
    expect(word("players").disabled).toBe(true);
    await act(async () => use().click());
    expect(useCurrent.mock.calls[0][0]).toMatchObject({
      text: "The timing matters here · window shuts · big · price",
      start: null,
      end: null,
    });
  });

  it("one chip per Take; an earlier Take's words save with its number", async () => {
    await renderSheet(null);
    expect(chips().map((c) => c.textContent)).toEqual(["Take 2 · now", "Take 1"]);
    expect(tokens().map((t) => t.textContent).join(" ")).toBe(TEXT);
    await act(async () => (chips()[1] as HTMLButtonElement).click());
    expect(tokens().map((t) => t.textContent).join(" ")).toBe(TAKE1);
    await act(async () => word("incumbents").click());
    expect(card().textContent).toContain("incumbents");
    await act(async () => use().click());
    expect(useFromTake).toHaveBeenCalledTimes(1);
    expect(useFromTake.mock.calls[0]).toEqual(["incumbents", 1]);
    expect(useCurrent).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("Delete asks once, then deletes", async () => {
    await renderSheet("the timing matters");
    expect(card().textContent).toContain("the timing matters");
    const del = container.querySelector('[data-testid="helper-words-delete"]') as HTMLButtonElement;
    await act(async () => del.click());
    // First tap: the card clears and the button asks; nothing is deleted yet.
    expect(onDelete).not.toHaveBeenCalled();
    expect(card().textContent).not.toContain("the timing matters");
    const confirm = container.querySelector('[data-testid="helper-words-delete-confirm"]') as HTMLButtonElement;
    expect(confirm.textContent).toBe("Delete helper words");
    await act(async () => confirm.click());
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("the button lights only when the words differ from the saved ones", async () => {
    await renderSheet("the timing matters");
    // Opened on the saved words, pre-selected: nothing to save.
    expect(card().textContent).toContain("the timing matters");
    expect(use().disabled).toBe(true);
    await act(async () => word("window").click());
    expect(use().disabled).toBe(false);
    await act(async () => word("window").click());
    expect(use().disabled).toBe(true);
    await act(async () => use().click());
    expect(useCurrent).not.toHaveBeenCalled();
  });
});
