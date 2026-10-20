// @vitest-environment jsdom
/*
STORY    As a speaker, I want my own words shown per slide, each paragraph its
         own block, and no scores, so that the Ideal Text is mine and judged
         in words.
OUTCOME
  O1  Every slide's words are shown unchanged, one paragraph block per
      slide, holding exactly that slide's words.
  O2  Never-1: a paragraph with feedback waiting paints no number or badge
      beside the words (its block holds the speaker's words and nothing else).
  O3  Never-1: nothing on the deck reads as a score, ratio, percentage or
      verdict, while the speaker's words are on screen.
PROVES   O1, O2 -> "shows the speaker's own words, one block per slide, unchanged"
         O3     -> "renders no score, ratio, percentage or verdict, even with a tentative pending item"
WHY      Never-1. The per-paragraph lock button is gone from the page (lock
         2026-10-12, section 4): a paragraph is the tap target and the lock
         lives in its sheet, so no lock-control count is pinned here.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
import type { Part } from "@/lib/willab/documentParts";
import type { DocumentSuggestion } from "@/services/api/idealText";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));

const SLIDES = [
  "Good morning. Today I want to show you how the pilot changed our numbers.",
  "Three things stood out: retention went up, churn went down, and the team stayed calm.",
  "So here is what I am asking for: one more quarter of the same budget.",
];
const parts: Part[] = SLIDES.map((text, i) => ({ id: `p${i + 1}`, text, locked: i === 2 }));
const document = SLIDES.join("\n\n");
const offset = document.indexOf("retention went up");
const suggestions: DocumentSuggestion[] = [
  {
    id: "s-rw", start: offset, end: offset + "retention went up".length,
    quote: "retention went up", kind: "replace", proposedText: "retention rose",
    feedbackFamily: "rewrite_clarity", device: null, tentative: true,
  } as DocumentSuggestion,
  /* THE ENTRY POINT (founder 2026-09-17). The sheet opens on the Confident
     Voice question and the rewrite follows INSIDE it — "first your voice" —
     so the mark is painted for the Confident Voice item, and the rewrite above
     rides the same paragraph rather than earning a mark of its own. */
  {
    id: "s-cv", start: offset, end: offset + "retention went up".length,
    quote: "retention went up", kind: "replace", proposedText: "retention rose",
    feedbackFamily: "confident_voice", source: "confident_voice",
    device: null, tentative: true,
    // A clip: a Confident Voice item nobody can hear is not asked (2026-09-29).
    snippetAudioRef: "https://media/moment.wav", startOffsetMs: 0, durationMs: 9000,
  } as DocumentSuggestion,
];

const SCORE_LIKE = [/\b\d+(\.\d+)?\s*%/, /\b\d+\s*\/\s*\d+\b/, /\b0\.\d{2}\b/, /\bscore\b/i, /\bverdict\b/i, /\bconfidence (level|index|rating)\b/i];

const noop = async () => true;
const props = {
  title: "My Q3 pitch",
  document,
  parts,
  suggestions,
  pieceSlideIndexes: [0, 1, 2],
  piecePartIds: ["p1", "p2", "p3"],
  slideTitles: ["Opening", "Results", "The ask"],
  onAccept: vi.fn(noop),
  onKeepMine: vi.fn(noop),
  onLockPart: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
  onSetRootPhrase: vi.fn(noop),
  onEditSlide: vi.fn(noop),
  onClose: vi.fn(),
};

// jsdom has no layout: the deck's scroll-snap positioning calls these.
Element.prototype.scrollTo = Element.prototype.scrollTo ?? (() => undefined);
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => undefined);

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document_.createElement("div");
  document_.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
// `document` is the fixture string above; the DOM document is aliased here.
const document_ = globalThis.document;

async function render(over: Partial<typeof props> = {}) {
  await act(async () => {
    root.render(createElement(TranscriptReviewDeck, { ...props, ...over }));
  });
  return container.textContent ?? "";
}

describe("TranscriptReviewDeck", () => {
  it("shows the speaker's own words, one block per slide, unchanged", async () => {
    await render();
    const blocks = [...container.querySelectorAll("[data-chunk]")];
    expect(blocks.map((b) => b.textContent)).toEqual(SLIDES);
    // Slide 2 carries the pending items: its block is still only the words.
    expect(blocks[1].getAttribute("data-opens-sheet")).toBe("true");
  });

  it("renders no score, ratio, percentage or verdict, even with a tentative pending item", async () => {
    const text = await render();
    expect(text).toContain(SLIDES[1]);
    for (const pattern of SCORE_LIKE) expect(text, `matched ${pattern}`).not.toMatch(pattern);
  });
});
