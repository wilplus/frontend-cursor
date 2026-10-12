// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE JUDGEMENT SHEET'S EXERCISE RUNG, AFTER 2026-10-10 (founder: "the    */
/*  practise screens should be the same in all cases"). The sheet records no  */
/*  practise of its own any more: the exercise is practised in the Feedback   */
/*  walk. What is left is the coach's sentence on a bookmark with no          */
/*  exercise, and the lane the answer chooses.                                */
/* -------------------------------------------------------------------------- */
import { act, createElement, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeckChunkModal from "./DeckChunkModal";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { DualCaptureState } from "@/hooks/useDualCaptureMic";
import { coachHasIt } from "@/lib/willab/paragraphOverlay";

/* One mic for every hook in the sheet (the service flow calls it too), so a
   state pushed here reaches the exercise step exactly as the browser's
   recorder would deliver it. */
type MicState = {
  status: string; message?: string; audioBlob?: unknown; durationSec?: number;
  finalText?: string; code?: string;
};
type MicStore = {
  state: MicState;
  set: (next: MicState) => void;
  subscribe: (listen: () => void) => () => void;
  started: number;
};
const mic = vi.hoisted((): MicStore => {
  const listeners = new Set<() => void>();
  const store: MicStore = {
    state: { status: "idle" },
    set(next) {
      store.state = next;
      listeners.forEach((listen) => listen());
    },
    subscribe(listen) {
      listeners.add(listen);
      return () => listeners.delete(listen);
    },
    started: 0,
  };
  return store;
});

vi.mock("@/hooks/useDualCaptureMic", () => ({
  useDualCaptureMic: () => {
    const state = useSyncExternalStore(mic.subscribe, () => mic.state);
    return {
      state: state as DualCaptureState,
      start: async () => { mic.started += 1; mic.set({ status: "recording", partialText: "" } as never); },
      stop: async () => {},
      cancel: () => { mic.set({ status: "idle" }); },
      getAudioStartedAt: () => null,
    };
  },
}));
vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({
  default: () => createElement("div", { "data-testid": "media-player" }),
}));
vi.mock("@/services/api/takeFeedback", async (load) => {
  const actual = await load<typeof import("@/services/api/takeFeedback")>();
  return { ...actual, saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })) };
});
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));

const practiceApi = vi.hoisted(() => ({
  startConfidencePractice: vi.fn(),
  uploadConfidencePracticeAttempt: vi.fn(),
  fetchConfidencePractice: vi.fn(async () => ({ ok: false, error: null })),
  savePracticeHelperWords: vi.fn(async () => true),
}));
vi.mock("@/services/api/confidentVoicePractice", () => practiceApi);

const TEXT =
  "We should ship it now because the data is clear and the team is ready.";

const item = {
  id: "s-cv-practice",
  start: 0,
  end: 21,
  quote: "We should ship it now",
  kind: "advice",
  proposedText: null,
  device: null,
  feedbackFamily: "confident_voice",
  source: "confident_voice",
  snippetId: "snip-1",
  takeSessionId: "take-1",
  practiceExercise: {
    exerciseId: "ex-1",
    version: 1,
    title: "Land the last word",
    instruction: "Say it again and land on the last word.",
    introduction: "",
    yesIntroduction: "",
    noIntroduction: "",
    explanationVideoRef: "https://example.test/ex.mp4",
    passage: "We should ship it now",
    practiceId: null,
    resume: false,
    doneBefore: false,
    chosenByCoach: false,
  },
  evidence: {
    projectId: "arc-1", takeSessionId: "take-1", slideIndex: 0,
    paragraphIndex: 0, start: 0, end: 21,
  },
} as unknown as DocumentSuggestion;

function chunk(): DeckChunk {
  return {
    part: { id: "p1", text: TEXT, locked: false },
    paragraphIndex: 0,
    start: 0,
    end: TEXT.length,
    status: "waiting",
    pendingIds: [item.id],
    approvedIds: [],
  } as DeckChunk;
}

const props = {
  onAccept: vi.fn(async () => true),
  onKeepMine: vi.fn(async () => true),
  onJudged: vi.fn(),
  onLockIn: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
  onSetRootPhrase: vi.fn(async () => true),
  onClose: vi.fn(),
  saveBehind: vi.fn((task: () => Promise<unknown>) => { void task(); }),
};

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mic.state = { status: "idle" };
  mic.started = 0;
  practiceApi.startConfidencePractice.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button"));
}
function button(label: string): HTMLButtonElement {
  const found = buttons().find(
    (b) => (b.textContent ?? "").trim() === label && !b.hasAttribute("data-sheet-grabber"),
  );
  if (!found) throw new Error(`no button labelled "${label}"`);
  return found;
}
async function click(label: string) {
  await act(async () => {
    button(label).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
const offer = () => container.querySelector('[data-testid="practice-offer"]');
/* THE BOOKMARK WITH NO EXERCISE (founder 2026-09-29): a No no longer leads
   nowhere. The server sends the bookmark to the coach when the answer saves;
   the sheet says so on the Exercise screen, and Continue is the way on. */
const bare = {
  ...item,
  id: "s-cv-bare",
  snippetId: "snip-2",
  practiceExercise: null,
} as unknown as DocumentSuggestion;

async function openBare() {
  props.onClose.mockClear();
  await act(async () => {
    root.render(
      createElement(DeckChunkModal, {
        ...props,
        state: chunkStateFor(
          { ...chunk(), pendingIds: [bare.id] } as DeckChunk,
          { document: TEXT, suggestions: [bare] },
        ),
      }),
    );
  });
}
const notice = () => container.querySelector('[data-testid="coach-request-notice"]');

const recognisedBare = { ...bare, id: "s-cv-rec-bare", problemRecognised: true } as DocumentSuggestion;

describe("a No on a bookmark with no exercise", () => {
  it("says the coach is working on it, with your recording, and Next moves on (D10)", async () => {
    // Read weak, a problem fired, nothing targets it: an error the coach
    // always answers with a video (the follow-up matrix, founder 2026-09-29).
    props.onClose.mockClear();
    await act(async () => {
      root.render(
        createElement(DeckChunkModal, {
          ...props,
          state: chunkStateFor(
            { ...chunk(), pendingIds: [recognisedBare.id] } as DeckChunk,
            { document: TEXT, suggestions: [recognisedBare] },
          ),
        }),
      );
    });
    await click("No");
    expect(notice()).not.toBeNull();
    expect(notice()?.textContent).toContain("Your coach is working on your exercise.");
    expect(notice()?.textContent).toContain("What you said");
    const labels = buttons().map((b) => b.textContent?.trim());
    expect(labels).toContain("Next");
    expect(labels).not.toContain("Practise");
    expect(props.onClose).not.toHaveBeenCalled();
    await click("Next");
    // The only item was answered and a No has no helper-words step: the
    // sheet is done, and the host closes it.
    expect(props.onClose).toHaveBeenCalled();
  });

  it("keeps the helper-words step, not the sentence, on a Yes", async () => {
    await openBare();
    await click("Yes");
    expect(notice()).toBeNull();
    expect(container.textContent).toContain("Tap the words");
  });

  it("closes on Audio unclear without the sentence", async () => {
    await openBare();
    await click("Audio unclear");
    expect(notice()).toBeNull();
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe("the paragraph sheet's line", () => {
  it("shows while the request is open and nothing came back", () => {
    const open = { ...bare, coachRequest: { status: "open", kind: "error" } } as DocumentSuggestion;
    expect(coachHasIt([open])).toBe(true);
    expect(coachHasIt([{ ...open, coachRequest: { status: "answered", kind: "error" } } as DocumentSuggestion])).toBe(false);
    // Only an error is a promise; the other kinds say nothing (Q6).
    for (const kind of ["praise", "rewrite", "ambiguity"] as const) {
      expect(coachHasIt([{ ...open, coachRequest: { status: "open", kind } } as DocumentSuggestion])).toBe(false);
    }
    expect(coachHasIt([{ ...open, practiceExercise: item.practiceExercise } as DocumentSuggestion])).toBe(false);
    expect(coachHasIt([bare])).toBe(false);
  });
});

describe("the lane on every bookmark (founder 2026-09-29)", () => {
  const recognised = { ...bare, id: "s-cv-rec", problemRecognised: true } as DocumentSuggestion;
  async function open(target: DocumentSuggestion) {
    props.onClose.mockClear();
    await act(async () => {
      root.render(
        createElement(DeckChunkModal, {
          ...props,
          state: chunkStateFor(
            { ...chunk(), pendingIds: [target.id] } as DeckChunk,
            { document: TEXT, suggestions: [target] },
          ),
        }),
      );
    });
  }

  it("an In-between with a recognised problem and no match: the sentence, then helper words", async () => {
    await open(recognised);
    await click("In-between");
    expect(notice()).not.toBeNull();
    await click("Next");
    expect(notice()).toBeNull();
    expect(container.textContent).toContain("Tap the words");
  });

  it("a Yes with a recognised problem shows nothing now: helper words directly", async () => {
    // The matrix (founder 2026-09-29): it reaches the coach as an ambiguity;
    // no sentence, their video comes if they record one.
    await open(recognised);
    await click("Yes");
    expect(notice()).toBeNull();
    expect(container.textContent).toContain("Tap the words");
  });

  it("a Yes never opens the library video, even when one is attached", async () => {
    await open(item);
    await click("Yes");
    expect(offer()).toBeNull();
    expect(container.textContent).toContain("Tap the words");
  });

  it("a No with nothing recognised is a rewrite: no sentence, the sheet ends", async () => {
    await open(bare);
    await click("No");
    expect(notice()).toBeNull();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("an In-between with nothing recognised: helper words directly, no sentence", async () => {
    await open(bare);
    await click("In-between");
    expect(notice()).toBeNull();
    expect(container.textContent).toContain("Tap the words");
  });

  it("Audio unclear never reaches an exercise, even when one is attached", async () => {
    await open(item);
    await click("Audio unclear");
    expect(offer()).toBeNull();
    expect(props.onClose).toHaveBeenCalled();
  });
});
