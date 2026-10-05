// @vitest-environment jsdom
/* MLC-3 §3.5 (label spec exercise-adequacy-label-v1): an exercise counts as
   shown only once the speaker's app confirms it rendered. The confirmation
   goes out the first time an exercise card is about half visible — never on
   data load, once per card per page view, fire-and-forget, and nothing about
   it ever reaches the speaker. A 409 means the card is stale: re-read. */
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
  finishConfidencePractice: vi.fn(async () => ({ ok: false, error: null })),
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
        renderSheet: (practiseAgain) =>
          createElement(DeckChunkModal, {
            state: s,
            practiseAgain,
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

  it("fires once per card per page view, however often it is seen", async () => {
    await render();
    await scrollTo("answered-exercise", 0.6);
    await scrollTo("answered-exercise", 0);
    await scrollTo("answered-exercise", 1);
    // Close and reopen the sheet: still the same page view.
    await act(async () => root.render(createElement("div")));
    await render("b");
    await scrollTo("answered-exercise", 1);
    expect(renderedCalls()).toHaveLength(1);
  });

  it("the Feedback sheet's exercise offer counts too, and shares the once", async () => {
    await render();
    const practise = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Practise",
    );
    await act(async () => practise?.click());
    expect(container.querySelector('[data-testid="practice-offer"]')).not.toBeNull();
    expect(renderedCalls()).toHaveLength(0);
    await scrollTo("practice-offer", 0.6);
    expect(renderedCalls()).toHaveLength(1);
  });

  it("never renders anything, whatever the answer", async () => {
    for (const [status, body] of [
      [200, { recorded: true }],
      [200, { recorded: false }],
      [404, { error: "NOT_FOUND" }],
      [409, { error: "EXERCISE_OFFER_STALE" }],
    ] as const) {
      resetExerciseRenderedForTests();
      reply(status, body);
      await render(`k-${status}-${String((body as { recorded?: boolean }).recorded)}`);
      const before = container.innerHTML;
      await scrollTo("answered-exercise", 0.6);
      expect(container.innerHTML).toBe(before);
      expect(container.textContent).not.toMatch(/render|record|stale|offer/i);
    }
  });

  it("a 409 re-reads the Ideal Text once and never retries", async () => {
    reply(409, { error: "EXERCISE_OFFER_STALE" });
    await render();
    await scrollTo("answered-exercise", 0.6);
    await scrollTo("answered-exercise", 1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(renderedCalls()).toHaveLength(1);
  });

  it("no automatic pick, or not the speaker's snippet: nothing happens", async () => {
    reply(200, { recorded: false });
    await render();
    await scrollTo("answered-exercise", 0.6);
    expect(refresh).not.toHaveBeenCalled();

    resetExerciseRenderedForTests();
    reply(404, { error: "NOT_FOUND" });
    await render("b");
    await scrollTo("answered-exercise", 0.6);
    expect(refresh).not.toHaveBeenCalled();
    expect(renderedCalls()).toHaveLength(2);
  });

  it("a network failure is swallowed and not retried", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    await render();
    await scrollTo("answered-exercise", 0.6);
    await scrollTo("answered-exercise", 1);
    expect(renderedCalls()).toHaveLength(1);
    expect(refresh).not.toHaveBeenCalled();
  });
});
