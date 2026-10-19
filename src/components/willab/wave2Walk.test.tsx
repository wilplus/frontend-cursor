// @vitest-environment jsdom
/*
 * STORY    As a speaker, I want my coach's unseen word reachable through
 *          "Review feedback" even when every moment is answered, and a
 *          paragraph whose helper words I deleted to rejoin the walk, so that
 *          I never miss my coach or a paragraph.
 * OUTCOME
 *   O1  Every moment answered and an unseen coach word: Review feedback
 *       stays, opens Step 0 only on its tap, and goes once seen (N48.3 Q11 A).
 *   O2  After Delete the paragraph rejoins the walk on its earlier answer,
 *       at once, not only when a moment is open on it (N48.2 Q6 A).
 * PROVES   O1 -> "every moment answered: Review feedback stays for the unseen word, ..."
 *          O2 -> "a paragraph whose helper words were deleted is back in the walk on its earlier answer"
 * WHY      Wave 2 of Closing the Gap (founder 2026-10-05). O2 is checked at the
 *          deck's own rule (buildBookmarks), not on the rendered deck.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
import { buildBookmarks, helperWordsDeleted } from "./feedbackPager";
import type { Part } from "@/lib/willab/documentParts";
import type { DeckChunk } from "@/lib/willab/deckChunks";
import {
  type CoachMessage,
  type DocumentSuggestion,
} from "@/services/api/idealText";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({ default: () => createElement("div") }));
vi.mock("@/services/api/bookmarkHistory", () => ({
  fetchOwnerAnswers: vi.fn(async () => [{ feedbackId: "s-cv", response: "yes" }]),
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
/** The moment on paragraph 2, already answered on this Take. */
const answered: DocumentSuggestion = {
  id: "s-cv", start: offset, end: offset + "retention went up".length,
  quote: "retention went up", kind: "advice", proposedText: null,
  feedbackFamily: "confident_voice", source: "confident_voice",
  device: null, tentative: false, status: "approved", bookmarkTier: "confident",
  snippetAudioRef: "https://media/moment.wav", startOffsetMs: 0, durationMs: 9000,
} as DocumentSuggestion;

const WORD: CoachMessage = {
  text: "Your opening landed. Keep the pause.",
  videoUrl: null,
  takeIndex: 2,
  publishedAt: "2026-10-05T09:00:00Z",
  takeSessionId: "take-2",
};

const noop = async () => true;
function props(over: Record<string, unknown> = {}) {
  const parts: Part[] = SLIDES.map((t, i) => ({ id: `p${i + 1}`, text: t }));
  return {
    title: "My Q3 pitch",
    document: text,
    parts,
    suggestions: [answered],
    pieceSlideIndexes: [0, 1, 2],
    piecePartIds: ["p1", "p2", "p3"],
    slideTitles: ["Opening", "Results", "The ask"],
    takeSessionId: "take-2",
    onAccept: vi.fn(noop),
    onKeepMine: vi.fn(noop),
    onLockPart: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
    onSetRootPhrase: vi.fn(noop),
    onEditSlide: vi.fn(noop),
    onClose: vi.fn(),
    ...over,
  };
}

Element.prototype.scrollTo = Element.prototype.scrollTo ?? (() => undefined);
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => undefined);

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
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
}
const step0 = () => document.querySelector("[data-coach-message-step]");
const pager = () => document.querySelector('[data-testid="feedback-pager"]');
const walkScreen = () =>
  document.querySelector("[data-feedback-walk] .walk-layer:not(.walk-ghost) [data-testid^='walk-screen-']");

/* --------------------------------------------------------------- Q11 A ---- */

describe("N48.3 Q11 A: the coach's word for the Take on screen", () => {

  it("every moment answered: Review feedback stays for the unseen word, opens Step 0 on its tap only, and goes once seen", async () => {
    const waiting = vi.fn();
    await render({ arcId: "arc-1", coachMessage: WORD, onReviewWaiting: waiting, reviewRequest: 0 });
    // J1: nothing opens by itself.
    expect(step0()).toBeNull();
    expect(waiting).toHaveBeenLastCalledWith(true);
    // The speaker taps "Review feedback": the walk opens on the coach's note.
    await render({ arcId: "arc-1", coachMessage: WORD, onReviewWaiting: waiting, reviewRequest: 1 });
    expect(walkScreen()?.getAttribute("data-testid")).toBe("walk-screen-coachnote");
    expect(walkScreen()?.textContent).toContain(WORD.text);
    expect(waiting).toHaveBeenLastCalledWith(false);
    // Continue: nothing waits, so the walk moves past its last screen.
    const cont = [...document.querySelectorAll("button")].find((b) => b.textContent === "Continue")!;
    await act(async () => cont.click());
    expect(walkScreen()).toBeNull();
    expect(pager()).toBeNull();
  });
});

describe("N48.2 Q6 A: after Delete the paragraph rejoins the walk", () => {
  // At the deck's own rule (buildBookmarks + helperWordsDeleted): the paragraph
  // was answered on an earlier Take and has nothing open now.
  const chunk = (part: Part) => ({ part }) as unknown as DeckChunk;
  const answeredEarlier = () => ({ pending: 0, decided: 1 });
  const walkOf = (part: Part, deletedHere = false) =>
    buildBookmarks(
      [chunk(part)],
      answeredEarlier,
      () => undefined,
      () => false,
      (c) => helperWordsDeleted(c.part, deletedHere, false),
    ).map((b) => b.partId);

  it("a paragraph whose helper words were deleted is back in the walk on its earlier answer", () => {
    // Never locked: an answered paragraph is not a moment of this walk.
    expect(walkOf({ id: "p2", text: SLIDES[1], locked: false, iteration: 0 })).toEqual([]);
    // Deleted on the server (once locked, unlocked now): it rejoins.
    expect(walkOf({ id: "p2", text: SLIDES[1], locked: false, iteration: 1 })).toEqual(["p2"]);
    // Deleted on this screen, before the next read says so: it rejoins at once.
    expect(walkOf({ id: "p2", text: SLIDES[1], locked: false, iteration: 0 }, true)).toEqual(["p2"]);
  });
});
