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
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ParagraphSheet from "./ParagraphSheet";
import { forgetParagraphSheetData } from "./paragraphSheetData";
import { forgetWalkHandoff } from "./walk/WalkSheetFrame";
import type { Pager } from "./feedbackPager";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { ParagraphHistory } from "@/services/api/bookmarkHistory";

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
});
