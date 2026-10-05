// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  A PARAGRAPH SAVED WITH HELPER WORDS HAS NO BAR (founder lock 2026-09-30,  */
/*  B7 and its interpretation Q3; contract 24g; audit 2026-10-05 B7-4, I-Q3,  */
/*  C24g).                                                                    */
/*                                                                            */
/*  The server's window withholds a saved paragraph's open moment from the   */
/*  next read on. Within the same visit the page still held the moment as    */
/*  waiting (a moment practised and then saved settles without an answer,    */
/*  24e-1), so its bar stayed until the page read again. The bar, and the    */
/*  "Review feedback" offer that follows the bar's condition, now give way   */
/*  as soon as the paragraph's headline is on the page.                      */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
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
/** The moment on paragraph 2, still waiting (practised and saved through
 *  the practise loop settles it without an answer, 24e-1). */
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

/** The recording-roots read: the paragraph's saved helper words, or none. */
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
const barOn = (el: HTMLElement) => el.querySelector("[data-tier]");

describe("B7 / Q3: a paragraph saved with helper words carries no bar", () => {
  it("a waiting moment without saved words draws its bar, and Review feedback is offered", async () => {
    serveRoots([]);
    const reviewWaiting = vi.fn();
    await render({ onReviewWaiting: reviewWaiting });
    const p2 = paragraphWith("retention went up");
    expect(barOn(p2)).not.toBeNull();
    expect(p2.getAttribute("data-settled")).toBeNull();
    expect(reviewWaiting).toHaveBeenLastCalledWith(true);
  });

  it("the same moment on a paragraph whose helper words are saved draws no bar", async () => {
    serveRoots([{ part_id: "p2", slide_index: 1, text: "retention went up" }]);
    const reviewWaiting = vi.fn();
    await render({ onReviewWaiting: reviewWaiting });
    const p2 = paragraphWith("retention went up");
    // Its headline is its mark.
    expect(p2.textContent).toContain("retention went up");
    expect(barOn(p2)).toBeNull();
    expect(container.querySelectorAll("[data-tier]")).toHaveLength(0);
    // Plain text, still its own tap target (B7: "still opens its own sheet").
    expect(p2.getAttribute("data-settled")).toBe("true");
    expect(p2.getAttribute("data-opens-sheet")).toBe("true");
    // Nothing waits on the page any more: "Review feedback" is not offered
    // for a moment the page shows no mark for.
    expect(reviewWaiting).toHaveBeenLastCalledWith(false);
  });

  it("only the saved paragraph loses its bar", async () => {
    const otherOffset = text.indexOf("one more quarter");
    const other = {
      ...waiting, id: "s-cv-3", start: otherOffset,
      end: otherOffset + "one more quarter".length, quote: "one more quarter",
      bookmarkTier: "confident",
    } as DocumentSuggestion;
    serveRoots([{ part_id: "p2", slide_index: 1, text: "retention went up" }]);
    await render({ suggestions: [waiting, other] });
    expect(barOn(paragraphWith("retention went up"))).toBeNull();
    expect(barOn(paragraphWith("one more quarter"))).not.toBeNull();
  });
});
