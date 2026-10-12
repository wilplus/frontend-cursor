// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The paragraph's screens and the helper-words overlay in the walk's look    */
/*  and motion (build plan D-IT-6; founder 2026-10-07, Q-B3 A, N63; walk lock  */
/*  "UI and UX" and "How screens move"; the only look since the founder's     */
/*  2026-10-11 "keep the new designs, make them permanent"):                  */
/*    - the walk's full-screen overlay (nothing of the page behind it), a     */
/*      still top bar with ‹ Slide n › and ✕, the content sliding under it,  */
/*      the overlay rising and sinking;                                       */
/*    - History, Edit and the helper-words save, lock and delete unchanged;   */
/*    - reduce motion: nothing moves, no leaving copy is drawn.               */
/* -------------------------------------------------------------------------- */
import { StrictMode, act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ParagraphSheet from "./ParagraphSheet";
import HelperWordsSheet from "./HelperWordsSheet";
import { forgetParagraphSheetData } from "./paragraphSheetData";
import { forgetWalkHandoff } from "./walk/WalkSheetFrame";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";
import type { Pager } from "./feedbackPager";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { ParagraphHistory } from "@/services/api/bookmarkHistory";
import type { RootPhraseSpan } from "@/services/api/partLock";

vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/hooks/useExerciseRenderedAck", () => ({
  useExerciseRenderedAck: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({
  default: () => createElement("div", { "data-testid": "media-player" }),
}));
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));
vi.mock("@/services/api/takeFeedback", async (load) => {
  const actual = await load<typeof import("@/services/api/takeFeedback")>();
  return { ...actual, saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })) };
});
vi.mock("@/services/api/bookmarkHistory", () => ({
  fetchOwnerAnswers: vi.fn(async () => [{ feedbackId: "s-cv", response: "yes" }]),
  fetchParagraphHistory: vi.fn(async () => HISTORY),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEXT = "We should ship it now because the data is clear.";
const HISTORY: ParagraphHistory = {
  slideIndex: 0,
  versions: [{ takeIndex: 1, paragraphs: [TEXT], at: null }],
  helperWords: [{ phrases: ["ship it now"], at: null }],
  practice: [],
} as unknown as ParagraphHistory;

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

let root: Root;
let container: HTMLDivElement;
let reduce = false;
beforeEach(() => {
  forgetParagraphSheetData();
  forgetWalkHandoff();
  reduce = false;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion: reduce"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.querySelectorAll("[data-walk-sink]").forEach((n) => n.remove());
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function draw(element: ReactElement) {
  await act(async () => {
    root.render(element);
  });
  // The read-ahead lands.
  await act(async () => {
    await Promise.resolve();
  });
}

const pagerAt = (index: number): Pager => ({
  index,
  total: 3,
  label: "Slide 2",
  onBack: vi.fn(),
  onNext: vi.fn(),
});

type Props = Parameters<typeof ParagraphSheet>[0];
function sheet(over: Partial<Props> = {}) {
  return createElement(ParagraphSheet, {
    arcId: "arc-1",
    takeSessionId: "take-1",
    partId: "p1",
    text: TEXT,
    headline: null,
    decided: [moment],
    onUseHelperWords: vi.fn(async () => true),
    pager: pagerAt(1),
    slideLabel: "Slide 2",
    onClose: vi.fn(),
    ...over,
  });
}

const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
/** The live screen (never the leaving copy). */
const live = () => q("[data-walk-stage] .walk-layer:not(.walk-ghost)");

describe("the walk's look", () => {
  it("is full screen with nothing of the page behind it", async () => {
    await draw(sheet());
    const stage = q("[data-walk-stage]")!;
    expect(stage.className).toMatch(/fixed inset-0 z-50/);
    const ov = live()!.querySelector(".walk-ov")!;
    expect(ov.className).toMatch(/h-full w-full/);
    expect(ov.className).toMatch(/bg-background/);
    expect(document.body.innerHTML).not.toMatch(/bg-foreground\/30/);
    expect(document.body.innerHTML).not.toMatch(/rounded-t-3xl/);
  });

  it("has one still top bar: ‹ Slide 2 › and ✕; the title and the content below it", async () => {
    await draw(sheet());
    const ov = live()!.querySelector(".walk-ov")!;
    const top = ov.firstElementChild!;
    expect(top.classList.contains("walk-ovtop")).toBe(true);
    const nav = top.querySelector("[data-walk-nav]")!;
    expect(nav.textContent).toBe("Slide 2");
    expect(nav.querySelector(`[aria-label='${COPY.pagerBack}']`)).not.toBeNull();
    expect(nav.querySelector(`[aria-label='${COPY.pagerNext}']`)).not.toBeNull();
    expect(top.querySelector("[aria-label='Close']")).not.toBeNull();
    // The title is not in the bar: it moves with the content.
    expect(top.textContent).not.toContain(COPY.titleParagraph);
    expect(ov.querySelector("h2")!.textContent).toBe(COPY.titleParagraph);
  });

  it("Back is off on the first moment", async () => {
    await draw(sheet({ pager: pagerAt(0) }));
    expect(q<HTMLButtonElement>(`[data-walk-nav] [aria-label='${COPY.pagerBack}']`)!.disabled).toBe(true);
  });

  it("outside the walk the bar reads the slide alone, no ‹ ›", async () => {
    await draw(sheet({ pager: null }));
    expect(q("[data-walk-nav]")).toBeNull();
    expect(q("[data-walk-caption]")!.textContent).toBe("Slide 2");
  });

  it("✕ and Escape close, as today", async () => {
    const onClose = vi.fn();
    await draw(sheet({ onClose }));
    await act(async () => q<HTMLButtonElement>(".walk-ovtop [aria-label='Close']")!.click());
    live()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("History, Edit and the helper words still work in the walk's look", () => {
  it("History opens; Edit opens the helper-words overlay; a pick saves and moves on", async () => {
    const onUse = vi.fn(async (_span: RootPhraseSpan) => true);
    const onDone = vi.fn();
    const helperWordsHost = { onUseFromTake: vi.fn(async () => true), onDelete: vi.fn(async () => true) };
    await draw(sheet({ headline: "ship it now", onUseHelperWords: onUse, onDone, helperWordsHost }));
    const history = live()!.querySelector<HTMLDetailsElement>('[data-testid="paragraph-history"]')!;
    expect(history.textContent).toContain(COPY.historyRow);
    await act(async () => history.querySelector("summary")!.click());
    expect(history.open).toBe(true);

    await act(async () => live()!.querySelector<HTMLButtonElement>('[data-testid="paragraph-helper-words"]')!.click());
    const words = live()!.querySelector('[data-testid="helper-words-sheet"]')!;
    expect(words.classList.contains("walk-ov")).toBe(true);
    // The saved words open selected; a tap on "ship" leaves "it now".
    const ship = Array.from(words.querySelectorAll<HTMLButtonElement>('[data-testid="picker-tokens"] button'))
      .find((b) => b.textContent === "ship")!;
    await act(async () => ship.click());
    const use = live()!.querySelector<HTMLButtonElement>('[data-testid="helper-words-use"]')!;
    expect(use.textContent).toBe(COPY.pillEmphasise);
    expect(use.disabled).toBe(false);
    await act(async () => use.click());
    expect(onUse).toHaveBeenCalledTimes(1);
    expect(onUse.mock.calls[0][0].text).toBe("it now");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("HelperWordsSheet on its own: the walk's look, with or without a place", async () => {
    const base = {
      headline: "ship it now",
      currentText: TEXT,
      history: HISTORY,
      onUseCurrent: vi.fn(async () => true),
      onClose: vi.fn(),
    };
    await draw(createElement(HelperWordsSheet, base));
    expect(live()!.querySelector('.walk-ov[data-testid="helper-words-sheet"]')).not.toBeNull();
    expect(q("[data-walk-caption]")).toBeNull();
    await draw(createElement(HelperWordsSheet, {
      ...base,
      walk: { nav: null, caption: "Slide 2", moment: null },
    }));
    expect(live()!.querySelector('.walk-ov[data-testid="helper-words-sheet"]')).not.toBeNull();
    expect(q("[data-walk-caption]")!.textContent).toBe("Slide 2");
  });
});

describe("how it moves (walk lock 'How screens move')", () => {
  it("rises over the page when it opens", async () => {
    await draw(sheet());
    expect(live()!.getAttribute("data-walk-move")).toBe("open");
    expect(live()!.classList.contains("walk-m-open")).toBe(true);
  });

  it("Edit: the content slides on under the still top bar, the old copy slipping away", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const helperWordsHost = { onUseFromTake: vi.fn(async () => true), onDelete: vi.fn(async () => true) };
    await draw(sheet({ headline: "ship it now", helperWordsHost }));
    await act(async () => live()!.querySelector<HTMLButtonElement>('[data-testid="paragraph-helper-words"]')!.click());
    expect(live()!.getAttribute("data-walk-move")).toBe("next");
    expect(live()!.classList.contains("walk-m-next")).toBe(true);
    const ghost = q("[data-walk-ghost]")!;
    expect(ghost.className).toMatch(/walk-ghost walk-m-swap walk-m-next/);
    expect(ghost.getAttribute("aria-hidden")).toBe("true");
    // The leaving copy is the saved screen, without its test ids.
    expect(ghost.textContent).toContain(COPY.titleSaved);
    expect(ghost.querySelector("[data-testid]")).toBeNull();
    // Only one screen is live, and no copy of the sheet sinks.
    expect(document.querySelectorAll("[data-walk-sink]").length).toBe(0);
    await act(async () => vi.advanceTimersByTime(400));
    expect(q("[data-walk-ghost]")).toBeNull();
  });

  it("moves the same under React's strict mode (effects run twice)", async () => {
    const helperWordsHost = { onUseFromTake: vi.fn(async () => true), onDelete: vi.fn(async () => true) };
    const props = { headline: "ship it now", helperWordsHost };
    await draw(createElement(StrictMode, null, sheet(props)));
    expect(live()!.getAttribute("data-walk-move")).toBe("open");
    await act(async () => live()!.querySelector<HTMLButtonElement>('[data-testid="paragraph-helper-words"]')!.click());
    expect(live()!.getAttribute("data-walk-move")).toBe("next");
    expect(q("[data-walk-ghost]")!.textContent).toContain(COPY.titleSaved);
  });

  it("‹ to an earlier moment slides back; › to a later one slides on", async () => {
    await draw(createElement("div", { key: "a" }, sheet({ pager: pagerAt(2) })));
    await draw(createElement("div", { key: "b" }, sheet({ pager: pagerAt(1) })));
    expect(live()!.getAttribute("data-walk-move")).toBe("back");
    expect(q("[data-walk-ghost]")!.className).toMatch(/walk-m-back/);
    await draw(createElement("div", { key: "c" }, sheet({ pager: pagerAt(2) })));
    expect(live()!.getAttribute("data-walk-move")).toBe("next");
  });

  it("sinks when it closes, the page already underneath, then the copy goes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await draw(sheet());
    await act(async () => root.render(createElement("div")));
    const sink = q("[data-walk-sink]")!;
    expect(sink.getAttribute("aria-hidden")).toBe("true");
    expect(sink.className).toMatch(/pointer-events-none/);
    expect(sink.querySelector(".walk-ghost.walk-m-close .walk-ov")).not.toBeNull();
    act(() => vi.advanceTimersByTime(400));
    expect(q("[data-walk-sink]")).toBeNull();
  });
});

describe("reduce motion: every move is instant", () => {
  it("opens, moves and closes with no move, no leaving copy and no sink", async () => {
    reduce = true;
    const helperWordsHost = { onUseFromTake: vi.fn(async () => true), onDelete: vi.fn(async () => true) };
    await draw(sheet({ headline: "ship it now", helperWordsHost }));
    expect(live()!.getAttribute("data-walk-move")).toBe("none");
    expect(document.body.innerHTML).not.toMatch(/walk-m-(open|next|back|fade|close|swap)/);
    await act(async () => live()!.querySelector<HTMLButtonElement>('[data-testid="paragraph-helper-words"]')!.click());
    expect(live()!.getAttribute("data-walk-move")).toBe("none");
    expect(q("[data-walk-ghost]")).toBeNull();
    expect(live()!.querySelector('[data-testid="helper-words-sheet"]')).not.toBeNull();
    await act(async () => root.render(createElement("div")));
    expect(q("[data-walk-sink]")).toBeNull();
    expect(document.body.innerHTML).not.toMatch(/walk-m-(open|next|back|fade|close|swap)/);
  });
});

describe("one player, no coloured chip in the walk's look (Q-WALK-PARA A)", () => {
  it("on: the walk's player with the moment's clip; no second player; no judgement chip", async () => {
    await draw(sheet());
    const players = live()!.querySelectorAll("[data-walk-player]");
    expect(players).toHaveLength(1);
    expect(q('[data-testid="media-player"]')).toBeNull();
    expect(q('[data-testid="judgement-label"]')).toBeNull();
    expect(document.body.textContent).not.toContain("Play this moment");
    // The answer still decides the buttons: a Yes moves on with Next.
    expect(q('[data-testid="overlay-practise"]')).not.toBeNull();
  });

  it("on a desktop the paragraph's screens are the walk's column too (Q-WALK-DESK A)", async () => {
    await draw(sheet());
    expect(live()!.closest("[data-walk-sheet]")).not.toBeNull();
  });

  it("on, with no clip: no player at all", async () => {
    const silent = { ...moment, snippetAudioRef: null } as unknown as DocumentSuggestion;
    await draw(sheet({ decided: [silent] }));
    expect(q("[data-walk-player]")).toBeNull();
  });
});
