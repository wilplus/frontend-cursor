// @vitest-environment jsdom
/*
 * STORY    As a speaker, I want only bookmarked paragraphs to open on tap, so
 *          that plain text stays plain and bookmarks stand out.
 * OUTCOME
 *   O1  A paragraph with no bookmark has no button role or focus, and a tap
 *       or Enter opens nothing; its text is unchanged.
 *   O2  A paragraph with a bar (the Take's feedback) still opens its sheet.
 *   O3  A paragraph saved with helper words opens its sheet too.
 * PROVES   O1 -> "the paragraphs with no bookmark are plain text, and a tap or a key opens nothing"
 *          O2 -> "a bookmarked paragraph still opens its sheet on tap"
 *          O3 -> "a paragraph saved with helper words opens on tap too"
 * WHY      Founder 2026-10-06 (N56.5), amending lock B7 of 2026-09-30.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
import { forgetHeadlineReads } from "./useSlideHeadlines";
import type { Part } from "@/lib/willab/documentParts";
import type { DocumentSuggestion } from "@/services/api/idealText";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({ default: () => createElement("div") }));
vi.mock("@/services/api/bookmarkHistory", () => ({
  fetchOwnerAnswers: vi.fn(async () => []),
  fetchParagraphHistory: vi.fn(async () => null),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SLIDES = [
  "Good morning. Today I want to show you how the pilot changed our numbers.",
  "Three things stood out: retention went up, churn went down, and the team stayed calm.",
  "So here is what I am asking for: one more quarter of the same budget.",
];
const text = SLIDES.join("\n\n");
const offset = text.indexOf("retention went up");
/** The Take's one moment, on paragraph 2, still waiting: its bar. */
const waiting: DocumentSuggestion = {
  id: "s-cv", start: offset, end: offset + "retention went up".length,
  quote: "retention went up", kind: "advice", proposedText: null,
  feedbackFamily: "confident_voice", source: "confident_voice",
  device: null, tentative: false, status: null, bookmarkTier: "confident",
  snippetAudioRef: "https://media/moment.wav", startOffsetMs: 0, durationMs: 9000,
} as DocumentSuggestion;

const noop = async () => true;
function props(over: Record<string, unknown> = {}) {
  const parts: Part[] = SLIDES.map((t, i) => ({ id: `p${i + 1}`, text: t }));
  return {
    title: "My Q3 pitch",
    arcId: "arc-1",
    document: text,
    parts,
    suggestions: [waiting],
    pieceSlideIndexes: [0, 1, 2],
    piecePartIds: ["p1", "p2", "p3"],
    slideTitles: ["Opening", "Results", "The ask"],
    takeSessionId: "take-1",
    onAccept: vi.fn(noop),
    onKeepMine: vi.fn(noop),
    onLockPart: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
    onSetRootPhrase: vi.fn(noop),
    onEditSlide: vi.fn(noop),
    onClose: vi.fn(),
    ...over,
  };
}

/** The recording-roots read: the paragraphs' saved helper words, or none. */
function serveRoots(roots: { part_id: string; slide_index: number; text: string }[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/recording-roots")) {
        return new Response(
          JSON.stringify({
            roots: roots.map((r) => ({ ...r, type: "flagship" })),
            document_snapshot_id: "snap-1",
            document_snapshot_sha256: "sha-1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("{}", { status: 404 });
    }),
  );
}

Element.prototype.scrollTo = Element.prototype.scrollTo ?? (() => undefined);
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => undefined);

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  forgetHeadlineReads();
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(over: Record<string, unknown> = {}) {
  await act(async () => {
    root.render(createElement(TranscriptReviewDeck, props(over)));
  });
  // The headline read lands after the first paint.
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

/** The paragraph element holding these words. */
function paragraphWith(words: string): HTMLElement {
  const found = [...container.querySelectorAll<HTMLElement>("[data-chunk]")]
    .find((el) => (el.textContent ?? "").includes(words));
  expect(found).toBeTruthy();
  return found!;
}
const sheetOpen = () => document.querySelector('[data-testid="paragraph-sheet"]') !== null;
const anyDialog = () => document.querySelector('[role="dialog"]') !== null;

/** Plain text: nothing about it says "button". */
function expectPlainText(el: HTMLElement) {
  expect(el.getAttribute("data-opens-sheet")).toBeNull();
  expect(el.getAttribute("role")).toBeNull();
  expect(el.getAttribute("tabindex")).toBeNull();
  expect(el.style.cursor).toBe("");
}

describe("N56.5: a paragraph that is not bookmarked does not open on tap", () => {
  it("the paragraphs with no bookmark are plain text, and a tap or a key opens nothing", async () => {
    serveRoots([]);
    await render();
    for (const words of ["pilot changed our numbers", "one more quarter"]) {
      const p = paragraphWith(words);
      expectPlainText(p);
      await act(async () => p.click());
      p.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      expect(sheetOpen()).toBe(false);
      expect(anyDialog()).toBe(false);
    }
    // Its text and layout are untouched.
    const p1 = paragraphWith("pilot changed our numbers");
    expect(p1.textContent).toBe(SLIDES[0]);
    expect(p1.getAttribute("data-settled")).toBe("true");
  });

  it("a bookmarked paragraph still opens its sheet on tap", async () => {
    // The bar: the Take's moment on paragraph 2.
    serveRoots([]);
    await render();
    const bar = paragraphWith("retention went up");
    expect(bar.getAttribute("role")).toBe("button");
    await act(async () => bar.click());
    expect(sheetOpen() || anyDialog()).toBe(true);
  });

  it("a paragraph saved with helper words opens on tap too", async () => {
    serveRoots([{ part_id: "p3", slide_index: 2, text: "one more quarter" }]);
    await render({ suggestions: [] });
    const saved = paragraphWith("same budget");
    expect(saved.getAttribute("role")).toBe("button");
    await act(async () => saved.click());
    expect(sheetOpen() || anyDialog()).toBe(true);
  });
});
