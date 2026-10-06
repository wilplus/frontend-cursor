// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  ONLY A BOOKMARK OPENS ON TAP (founder 2026-10-06, chat 20:37 UTC,         */
/*  decisions log N56.5): "a paragraph that is not bookmarked should not      */
/*  open on tap". Amends lock B7 of 2026-09-30 ("a paragraph with nothing     */
/*  open is plain text at full width and still opens its own sheet on tap"). */
/*                                                                            */
/*  A bookmark is a paragraph in the Take's feedback set (its orange or      */
/*  green bar) or one saved with helper words (its orange headline); both    */
/*  keep opening exactly as before. Any other paragraph is plain text: no    */
/*  button role, no focus, no pointer, and a tap opens nothing.              */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
import { bookmarkPartIds, opensFromPage, type Bookmark } from "./feedbackPager";
import type { Part } from "@/lib/willab/documentParts";
import type { DocumentSuggestion } from "@/services/api/idealText";

vi.mock("./useConfidentMomentBundle", () => ({
  useConfidentMomentBundle: () => ({ projection: null, status: "off", refresh: () => undefined }),
}));
vi.mock("./ConfidentMomentCoachingBundle", () => ({ default: () => null }));
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
/** A tap target, exactly as before the decision. */
function expectTapTarget(el: HTMLElement) {
  expect(el.getAttribute("data-opens-sheet")).toBe("true");
  expect(el.getAttribute("role")).toBe("button");
  expect(el.getAttribute("tabindex")).toBe("0");
  expect(el.style.cursor).toBe("pointer");
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
    expect(p1.className).toContain("text-foreground");
  });

  it("the paragraph with a bar is a bookmark and still opens on tap", async () => {
    serveRoots([]);
    await render();
    const p2 = paragraphWith("retention went up");
    expect(p2.querySelector("[data-tier]")).not.toBeNull();
    expectTapTarget(p2);
    await act(async () => p2.click());
    expect(anyDialog()).toBe(true);
  });

  it("a paragraph saved with helper words is a bookmark and still opens on tap", async () => {
    // p2 saved, so its bar gives way to its headline (B7, Q3); p3 saved
    // with no feedback on it at all -- the headline alone makes it a
    // bookmark (B8).
    serveRoots([
      { part_id: "p2", slide_index: 1, text: "retention went up" },
      { part_id: "p3", slide_index: 2, text: "one more quarter" },
    ]);
    await render();
    const p3 = paragraphWith("of the same budget");
    expect(p3.querySelector("[data-paragraph-headline]")).not.toBeNull();
    expect(p3.querySelector("[data-tier]")).toBeNull();
    expectTapTarget(p3);
    expectTapTarget(paragraphWith("churn went down"));
    // ...while the paragraph with neither stays plain text.
    expectPlainText(paragraphWith("pilot changed our numbers"));
    await act(async () => p3.click());
    expect(sheetOpen()).toBe(true);
  });
});

describe("opensFromPage / bookmarkPartIds (pure)", () => {
  const bookmark = (partId: string) =>
    ({ partId, chunk: {}, bundleId: null, coach: false }) as unknown as Bookmark;

  it("collects the bookmarks' part ids", () => {
    expect([...bookmarkPartIds([bookmark("a"), bookmark("c")])]).toEqual(["a", "c"]);
    expect(bookmarkPartIds([]).size).toBe(0);
  });

  it("opens only a bookmark, and a bookmark only where it opened before", () => {
    const ids = bookmarkPartIds([bookmark("a")]);
    expect(opensFromPage(ids, "a", true)).toBe(true);
    expect(opensFromPage(ids, "a", false)).toBe(false);
    expect(opensFromPage(ids, "b", true)).toBe(false);
    expect(opensFromPage(ids, "b", false)).toBe(false);
  });
});
