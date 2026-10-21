// @vitest-environment jsdom
/*
STORY    As a speaker, I want a paragraph I saved with helper words in this
         Take to lose its feedback bar at once, and a later Take's confident
         moment to be praised first even on a paragraph that keeps my earlier
         helper words, so that the page shows my progress and the walk starts
         with what I did well.
OUTCOME
  O1  A paragraph saved with helper words in this Take has no bar but still
      opens when tapped, and "Review feedback" is no longer offered.
  O2  Helper words kept from an earlier Take settle nothing: this Take's
      confident moment on that paragraph still waits, and the walk opens on
      it before the correction.
PROVES   O1 -> "the same moment on a paragraph whose helper words are saved draws no bar"
         O2 -> "helper words from an earlier Take: this Take's confident moment is walked first"
WHY      Founder lock 2026-09-30, B7 / Q3; docs/flows/feedback-walk-and-chat.md
         C2 ("praise first and then the corrections"), founder 2026-10-21.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
import { forgetHeadlineReads } from "./useSlideHeadlines";
import type { Part } from "@/lib/willab/documentParts";
import type { DocumentSuggestion } from "@/services/api/idealText";

/** The Lounge thread: the speaker's helper-words bubbles for each Take. */
const chat = vi.hoisted(() => ({ messages: [] as unknown[] }));
vi.mock("./LoungeThreadContext", () => ({
  useLoungeThreadMaybe: () => ({
    messages: chat.messages,
    loading: false,
    append: async (draft: unknown) => draft,
    reload: async () => undefined,
  }),
}));
vi.mock("@/services/api/consentChoices", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/consentChoices")>()),
  practiseOfferedNow: () => true,
  readPractiseOffered: async () => true,
}));
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

const at3 = text.indexOf("one more quarter");
/** The Take's corrected moment, on paragraph 3. */
const corrected: DocumentSuggestion = {
  ...waiting, id: "s-cv3", start: at3, end: at3 + "one more quarter".length,
  quote: "one more quarter", bookmarkTier: "weak", practicePrompt: true,
} as DocumentSuggestion;

/** The speaker's helper-words bubble for `part`, picked in `take`'s walk. */
const picked = (part: string, take: string) => ({
  id: `w-${part}-${take}`, client_id: `w-${part}-${take}`, role: "user", kind: "walk_step", body: "retention went up",
  metadata: { take_session_id: take, words_of: part, step: `words:${part}:retention went up` },
});

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
  chat.messages = [];
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
const barOn = (el: HTMLElement) => el.querySelector("[data-tier]");

describe("B7 / Q3: a paragraph saved with helper words carries no bar", () => {

  it("the same moment on a paragraph whose helper words are saved draws no bar", async () => {
    serveRoots([{ part_id: "p2", slide_index: 1, text: "retention went up" }]);
    chat.messages = [picked("p2", "take-1")];
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
});

describe("C2: a later Take's confident moment comes first", () => {
  it("helper words from an earlier Take: this Take's confident moment is walked first", async () => {
    // The words on paragraph 2 were picked in Take 1; this is Take 2.
    serveRoots([{ part_id: "p2", slide_index: 1, text: "retention went up" }]);
    chat.messages = [picked("p2", "take-1")];
    const take2 = { takeSessionId: "take-2", takeCount: 2, suggestions: [waiting, corrected] };
    await render(take2);
    expect(paragraphWith("retention went up").getAttribute("data-settled")).toBeNull();
    await render({ ...take2, reviewRequest: 1 });
    expect(document.querySelector("[data-feedback-walk]")?.getAttribute("data-walk-step")).toBe("praise");
  });
});
