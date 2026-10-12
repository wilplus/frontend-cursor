// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  Wave 2 of Closing the Gap (founder 2026-10-05), on the real deck.         */
/*                                                                            */
/*  N48.2 Q6 A (lock B4-5): after Delete the paragraph rejoins the walk at    */
/*  once on its earlier answer, not only when a moment is still open on it.  */
/*                                                                            */
/*  N48.3 Q11 A (35g-6, L8-1, L6-5): a coach's word belongs to its Take, and */
/*  Step 0 "Your coach" is reached whenever an unseen word exists for the    */
/*  Take on screen, even after every moment is answered: through the        */
/*  existing "Review feedback" entry, and only on its tap (J1).              */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
import type { Part } from "@/lib/willab/documentParts";
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
