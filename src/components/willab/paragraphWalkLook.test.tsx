// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The paragraph's screens and the helper-words overlay in the walk's look    */
/*  and motion (build plan D-IT-6; founder 2026-10-07, Q-B3 A, N63; walk lock  */
/*  "UI and UX" and "How screens move"):                                       */
/*    - with the walk's switch off, today's sheets, untouched;                */
/*    - with it on, the walk's full-screen overlay (nothing of the page        */
/*      behind it), a still top bar with ‹ Slide n › and ✕, the content       */
/*      sliding under it, the overlay rising and sinking;                     */
/*    - every visible string the same in both looks;                          */
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

/** Every string a reader meets, in any order: text and accessible names. */
function strings(root: Element): string[] {
  const out: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent?.trim();
    if (t) out.push(t);
  }
  root.querySelectorAll("[aria-label]").forEach((el) => out.push(`aria:${el.getAttribute("aria-label")}`));
  return out.sort();
}

async function stringsIn(look: boolean, over: Partial<Props>, sel: string) {
  await draw(sheet({ ...over, walkLook: look }));
  const el = q(sel)!;
  expect(el).not.toBeNull();
  const out = strings(el);
  await act(async () => root.render(createElement("div")));
  document.querySelectorAll("[data-walk-sink]").forEach((n) => n.remove());
  forgetParagraphSheetData();
  forgetWalkHandoff();
  return out;
}

describe("the switch decides the look (Q-B3: when the walk goes live)", () => {
  it("off: today's sheet, the page dimmed behind it, today's ‹ › bar", async () => {
    await draw(sheet());
    expect(q("[data-walk-stage]")).toBeNull();
    expect(q('[data-testid="paragraph-sheet"]')!.className).toMatch(/bg-foreground\/30/);
    expect(q('[data-testid="feedback-pager"]')).not.toBeNull();
  });

  it("on (NEXT_PUBLIC_FEEDBACK_WALK=on): the walk's overlay", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_WALK", "on");
    await draw(sheet());
    expect(live()!.querySelector('.walk-ov[data-testid="paragraph-sheet"]')).not.toBeNull();
    expect(q('[data-testid="feedback-pager"]')).toBeNull();
  });
});

describe("the walk's look", () => {
  it("is full screen with nothing of the page behind it", async () => {
    await draw(sheet({ walkLook: true }));
    const stage = q("[data-walk-stage]")!;
    expect(stage.className).toMatch(/fixed inset-0 z-50/);
    const ov = live()!.querySelector(".walk-ov")!;
    expect(ov.className).toMatch(/h-full w-full/);
    expect(ov.className).toMatch(/bg-background/);
    expect(document.body.innerHTML).not.toMatch(/bg-foreground\/30/);
    expect(document.body.innerHTML).not.toMatch(/rounded-t-3xl/);
  });

  it("has one still top bar: ‹ Slide 2 › and ✕; the title and the content below it", async () => {
    await draw(sheet({ walkLook: true }));
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
    await draw(sheet({ walkLook: true, pager: pagerAt(0) }));
    expect(q<HTMLButtonElement>(`[data-walk-nav] [aria-label='${COPY.pagerBack}']`)!.disabled).toBe(true);
  });

  it("outside the walk the bar reads the slide alone, no ‹ ›", async () => {
    await draw(sheet({ walkLook: true, pager: null }));
    expect(q("[data-walk-nav]")).toBeNull();
    expect(q("[data-walk-caption]")!.textContent).toBe("Slide 2");
  });

  it("✕ and Escape close, as today", async () => {
    const onClose = vi.fn();
    await draw(sheet({ walkLook: true, onClose }));
    await act(async () => q<HTMLButtonElement>(".walk-ovtop [aria-label='Close']")!.click());
    live()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

/** The walk's player's own words (its clip length, its accessible name: the
 *  walk's signed "moment n of m"): the one player replaces today's, whose
 *  words the mocked MediaPlayer does not draw (Q-WALK-PARA A). */
const lessWalkPlayer = (list: string[]) =>
  list.filter((line) => !/^\d+:\d\d$/.test(line) && !/^aria:(Play|Pause) moment /.test(line));

describe("every string is unchanged between the two looks", () => {
  it("This paragraph: the same, less the tinted judgement chip (Q-WALK-PARA A)", async () => {
    const off = await stringsIn(false, {}, '[data-testid="paragraph-sheet"]');
    const on = await stringsIn(true, {}, '[data-testid="paragraph-sheet"]');
    expect(off).toContain(COPY.titleParagraph);
    expect(off).toContain(COPY.judgementLabel);
    const chip = new Set<string>([COPY.judgementLabel, COPY.judgementWord.yes]);
    expect(lessWalkPlayer(on)).toEqual(off.filter((line) => !chip.has(line)));
  });

  it("Helper words saved", async () => {
    const over = { headline: "ship it now", firstTake: true };
    const off = await stringsIn(false, over, '[data-testid="paragraph-sheet"]');
    const on = await stringsIn(true, over, '[data-testid="paragraph-sheet"]');
    expect(off).toContain(COPY.titleSaved);
    expect(lessWalkPlayer(on)).toEqual(off);
  });

  it("the helper-words overlay", async () => {
    const helperWordsHost = { onUseFromTake: vi.fn(async () => true), onDelete: vi.fn(async () => true) };
    const over = { headline: "ship it now", startPicking: true, helperWordsHost };
    const off = await stringsIn(false, over, '[data-testid="helper-words-sheet"]');
    const on = await stringsIn(true, over, '[data-testid="helper-words-sheet"]');
    expect(off).toContain(COPY.historyHelperWords);
    expect(on).toEqual(off);
  });

  it("the picker, with its Take 1 note", async () => {
    const over = { startPicking: true, firstTake: true, pager: null, slideLabel: null };
    const off = await stringsIn(false, over, '[data-testid="paragraph-sheet"]');
    const on = await stringsIn(true, over, '[data-testid="paragraph-sheet"]');
    expect(off).toContain(COPY.titleEmphasis);
    expect(on).toEqual(off);
  });
});

describe("History, Edit and the helper words still work in the walk's look", () => {
  it("History opens; Edit opens the helper-words overlay; a pick saves and moves on", async () => {
    const onUse = vi.fn(async (_span: RootPhraseSpan) => true);
    const onDone = vi.fn();
    const helperWordsHost = { onUseFromTake: vi.fn(async () => true), onDelete: vi.fn(async () => true) };
    await draw(sheet({ walkLook: true, headline: "ship it now", onUseHelperWords: onUse, onDone, helperWordsHost }));
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

  it("Delete asks once, then clears the words", async () => {
    const onDelete = vi.fn(async () => true);
    const helperWordsHost = { onUseFromTake: vi.fn(async () => true), onDelete };
    await draw(sheet({ walkLook: true, headline: "ship it now", startPicking: true, helperWordsHost }));
    await act(async () => live()!.querySelector<HTMLButtonElement>('[data-testid="helper-words-delete"]')!.click());
    const confirm = live()!.querySelector<HTMLButtonElement>('[data-testid="helper-words-delete-confirm"]')!;
    expect(confirm.textContent).toBe(COPY.helperWordsDeleteConfirm);
    await act(async () => confirm.click());
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("HelperWordsSheet on its own: the walk's look only when asked", async () => {
    const base = {
      headline: "ship it now",
      currentText: TEXT,
      history: HISTORY,
      onUseCurrent: vi.fn(async () => true),
      onClose: vi.fn(),
    };
    await draw(createElement(HelperWordsSheet, base));
    expect(q("[data-walk-stage]")).toBeNull();
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
    await draw(sheet({ walkLook: true }));
    expect(live()!.getAttribute("data-walk-move")).toBe("open");
    expect(live()!.classList.contains("walk-m-open")).toBe(true);
  });

  it("Edit: the content slides on under the still top bar, the old copy slipping away", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const helperWordsHost = { onUseFromTake: vi.fn(async () => true), onDelete: vi.fn(async () => true) };
    await draw(sheet({ walkLook: true, headline: "ship it now", helperWordsHost }));
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
    const props = { walkLook: true, headline: "ship it now", helperWordsHost };
    await draw(createElement(StrictMode, null, sheet(props)));
    expect(live()!.getAttribute("data-walk-move")).toBe("open");
    await act(async () => live()!.querySelector<HTMLButtonElement>('[data-testid="paragraph-helper-words"]')!.click());
    expect(live()!.getAttribute("data-walk-move")).toBe("next");
    expect(q("[data-walk-ghost]")!.textContent).toContain(COPY.titleSaved);
  });

  it("‹ to an earlier moment slides back; › to a later one slides on", async () => {
    await draw(createElement("div", { key: "a" }, sheet({ walkLook: true, pager: pagerAt(2) })));
    await draw(createElement("div", { key: "b" }, sheet({ walkLook: true, pager: pagerAt(1) })));
    expect(live()!.getAttribute("data-walk-move")).toBe("back");
    expect(q("[data-walk-ghost]")!.className).toMatch(/walk-m-back/);
    await draw(createElement("div", { key: "c" }, sheet({ walkLook: true, pager: pagerAt(2) })));
    expect(live()!.getAttribute("data-walk-move")).toBe("next");
  });

  it("sinks when it closes, the page already underneath, then the copy goes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await draw(sheet({ walkLook: true }));
    await act(async () => root.render(createElement("div")));
    const sink = q("[data-walk-sink]")!;
    expect(sink.getAttribute("aria-hidden")).toBe("true");
    expect(sink.className).toMatch(/pointer-events-none/);
    expect(sink.querySelector(".walk-ghost.walk-m-close .walk-ov")).not.toBeNull();
    act(() => vi.advanceTimersByTime(400));
    expect(q("[data-walk-sink]")).toBeNull();
  });

  it("the motion is the lock's: 0.38 s up, 0.28 s down, 22 px out in 0.14 s, in 0.3 s after 0.1 s", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.walk-m-open > \.walk-ov \{\s*animation: walk-sheet-up 0\.38s/);
    expect(css).toMatch(/\.walk-ghost\.walk-m-close > \.walk-ov \{\s*animation: walk-sheet-down 0\.28s/);
    expect(css).toMatch(/\.walk-m-next > \.walk-ov > :not\(\.walk-ovtop\) \{\s*animation: walk-in-r 0\.3s var\(--walk-ease-arrive\) 0\.1s/);
    expect(css).toMatch(/\.walk-ghost\.walk-m-next > \.walk-ov > :not\(\.walk-ovtop\) \{\s*animation: walk-out-l 0\.14s/);
    expect(css).toMatch(/@keyframes walk-out-l \{\s*to \{ transform: translateX\(-22px\)/);
  });
});

describe("reduce motion: every move is instant", () => {
  it("opens, moves and closes with no move, no leaving copy and no sink", async () => {
    reduce = true;
    const helperWordsHost = { onUseFromTake: vi.fn(async () => true), onDelete: vi.fn(async () => true) };
    await draw(sheet({ walkLook: true, headline: "ship it now", helperWordsHost }));
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

  it("the CSS makes every walk move instant and hides the leaving copy", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/app/globals.css", "utf8");
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .walk-stage,"));
    expect(block).toMatch(/\.walk-stage \*,[\s\S]*?animation-duration: 0\.01s !important;[\s\S]*?transition-duration: 0\.01s !important;/);
    expect(block).toMatch(/\.walk-ghost \{\s*display: none !important;/);
  });
});

describe("one player, no coloured chip in the walk's look (Q-WALK-PARA A)", () => {
  it("on: the walk's player with the moment's clip; no second player; no judgement chip", async () => {
    await draw(sheet({ walkLook: true }));
    const players = live()!.querySelectorAll("[data-walk-player]");
    expect(players).toHaveLength(1);
    expect(q('[data-testid="media-player"]')).toBeNull();
    expect(q('[data-testid="judgement-label"]')).toBeNull();
    expect(document.body.textContent).not.toContain("Play this moment");
    // The answer still decides the buttons: a Yes moves on with Next.
    expect(q('[data-testid="overlay-practise"]')).not.toBeNull();
  });

  it("off: today's sheet keeps its player and its chip", async () => {
    await draw(sheet({ walkLook: false }));
    expect(q('[data-testid="media-player"]')).not.toBeNull();
    expect(q("[data-walk-player]")).toBeNull();
    expect(q('[data-testid="judgement-label"]')).not.toBeNull();
  });

  it("on a desktop the paragraph's screens are the walk's column too (Q-WALK-DESK A)", async () => {
    await draw(sheet({ walkLook: true }));
    expect(live()!.closest("[data-walk-sheet]")).not.toBeNull();
  });

  it("on, with no clip: no player at all", async () => {
    const silent = { ...moment, snippetAudioRef: null } as unknown as DocumentSuggestion;
    await draw(sheet({ walkLook: true, decided: [silent] }));
    expect(q("[data-walk-player]")).toBeNull();
  });
});
