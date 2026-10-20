// @vitest-environment jsdom
/*
 * STORY    As the founder, I want an exercise counted as shown only once the
 *          speaker actually saw it, once per view, silently, so that exercise
 *          data is honest.
 * OUTCOME
 *   O1  Nothing goes out on data load; the ack goes out once the card is
 *       about half visible.
 *   O2  Once per card per page view, even when the sheet is opened again.
 *   O3  A 409 (stale offer) makes the host re-read the Ideal Text.
 *   O4  Nothing about it reaches the speaker: the screen is the same before
 *       and after the ack, a 409 included.
 * PROVES   O1 -> "does not fire on data load, only once the card is about half visible"
 *          O2, O4 -> "fires once per card in a page view, even when the sheet reopens"
 *          O3, O4 -> "a 409 asks the host to re-read and shows the speaker nothing"
 * WHY      MLC-3 §3.5 (label spec exercise-adequacy-label-v1).
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenChunkSheet from "./OpenChunkSheet";
import DeckChunkModal from "./DeckChunkModal";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import { resetExerciseRenderedForTests } from "@/hooks/useExerciseRenderedAck";

vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({
  default: () => createElement("div"),
}));
vi.mock("@/services/api/takeFeedback", async (load) => {
  const actual = await load<typeof import("@/services/api/takeFeedback")>();
  return { ...actual, saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })) };
});
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));
vi.mock("@/services/api/confidentVoicePractice", () => ({
  startConfidencePractice: vi.fn(async () => ({ ok: false, error: null })),
  uploadConfidencePracticeAttempt: vi.fn(async () => ({ ok: false, error: null })),
  fetchConfidencePractice: vi.fn(async () => ({ ok: false, error: null })),
}));
vi.mock("@/services/api/bookmarkHistory", () => ({
  fetchOwnerAnswers: vi.fn(async () => [
    { feedbackId: "s-cv", response: "not_sure" },
  ]),
  fetchParagraphHistory: vi.fn(async () => null),
}));

const TEXT = "We should ship it now because the data is clear.";

const answered = {
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
  practiceExercise: {
    exerciseId: "ex-1",
    instruction: "Say it again, slower.",
    chosenByCoach: true,
  },
  evidence: {
    projectId: "arc-1",
    takeSessionId: "take-1",
    slideIndex: 0,
    paragraphIndex: 0,
    start: 0,
    end: 21,
  },
} as unknown as DocumentSuggestion;

function state() {
  return chunkStateFor(
    {
      part: { id: "p1", text: TEXT, locked: false },
      paragraphIndex: 0,
      start: 0,
      end: TEXT.length,
      status: "clean",
      pendingIds: [],
      approvedIds: [],
      decidedIds: [answered.id],
    } as DeckChunk,
    { document: TEXT, suggestions: [answered] },
  );
}

/* A controllable IntersectionObserver: the test decides what is on screen. */
type Observed = { callback: IntersectionObserverCallback; elements: Element[] };
let observers: Observed[] = [];
class FakeIntersectionObserver {
  private entry: Observed;
  constructor(callback: IntersectionObserverCallback) {
    this.entry = { callback, elements: [] };
    observers.push(this.entry);
  }
  observe(element: Element) {
    this.entry.elements.push(element);
  }
  unobserve() {}
  disconnect() {
    this.entry.elements = [];
  }
  takeRecords() {
    return [];
  }
}

async function scrollTo(testId: string, ratio: number) {
  await act(async () => {
    for (const o of [...observers]) {
      const target = o.elements.find(
        (el) => el.getAttribute("data-testid") === testId,
      );
      if (!target) continue;
      o.callback(
        [
          {
            target,
            isIntersecting: ratio > 0,
            intersectionRatio: ratio,
            intersectionRect: { height: 100 * ratio } as DOMRectReadOnly,
            rootBounds: { height: 800 } as DOMRectReadOnly,
          } as unknown as IntersectionObserverEntry,
        ],
        o as unknown as IntersectionObserver,
      );
    }
    await Promise.resolve();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

let root: Root;
let container: HTMLDivElement;
let fetchMock: ReturnType<typeof vi.fn>;
const refresh = vi.fn();

function reply(status: number, body: unknown) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  observers = [];
  resetExerciseRenderedForTests();
  refresh.mockReset();
  fetchMock = vi.fn();
  reply(200, { recorded: true });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function render(key = "a") {
  const s = state();
  return act(async () => {
    root.render(
      createElement(OpenChunkSheet, {
        key,
        state: s,
        arcId: "arc-1",
        takeSessionId: "take-1",
        headline: null,
        onDocumentChanged: refresh,
        onClose: vi.fn(),
        renderSheet: () =>
          createElement(DeckChunkModal, {
            state: s,
            onAccept: vi.fn(async () => true),
            onKeepMine: vi.fn(async () => true),
            onLockIn: vi.fn(async () => ({
              outcome: "ok" as const,
              rootPhraseProposal: null,
            })),
            onSetRootPhrase: vi.fn(async () => true),
            onDocumentChanged: refresh,
            onClose: vi.fn(),
          }),
      }),
    );
  });
}

function renderedCalls() {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).includes("/exercise-rendered"),
  );
}

describe("exercise rendered — the speaker's app confirms the card was seen", () => {
  it("does not fire on data load, only once the card is about half visible", async () => {
    await render();
    expect(container.querySelector('[data-testid="answered-exercise"]')).not.toBeNull();
    expect(renderedCalls()).toHaveLength(0);

    await scrollTo("answered-exercise", 0.3);
    expect(renderedCalls()).toHaveLength(0);

    await scrollTo("answered-exercise", 0.6);
    expect(renderedCalls()).toHaveLength(1);
    const [url, init] = renderedCalls()[0];
    expect(url).toBe("/api/v2/user/snippets/snip-1/exercise-rendered");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(init.body)).toEqual({ exercise_id: "ex-1" });
  });

  it("fires once per card in a page view, even when the sheet reopens", async () => {
    await render("a");
    const before = container.textContent;
    await scrollTo("answered-exercise", 0.6);
    await scrollTo("answered-exercise", 0.9);
    expect(renderedCalls()).toHaveLength(1);
    expect(container.textContent).toBe(before);

    await render("b");
    expect(container.querySelector('[data-testid="answered-exercise"]')).not.toBeNull();
    await scrollTo("answered-exercise", 0.6);
    expect(renderedCalls()).toHaveLength(1);
  });

  it("a 409 asks the host to re-read and shows the speaker nothing", async () => {
    reply(409, { code: "EXERCISE_STALE" });
    await render();
    const before = container.textContent;
    expect(before).toContain("Say it again, slower.");
    await scrollTo("answered-exercise", 0.6);
    expect(renderedCalls()).toHaveLength(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe(before);
  });
});
