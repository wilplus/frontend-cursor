// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE EXERCISE STEP, DRIVEN END TO END (contract 29a, locked screen L1).     */
/*                                                                            */
/*  Four defects found the day before a tester's first walk, each pinned by   */
/*  a behaviour rather than a source grep:                                    */
/*    1. the recording screen stayed up, clock running, when the mic could    */
/*       not start (permission refused) or the practice could not be opened   */
/*       — the only way off was the close button;                             */
/*    2. the first recording read "Attempt 3", because the attempt number     */
/*       was derived from a cap that is unknown until a practice row exists;  */
/*    3. the practice judgement opened with the speaker's answer about the    */
/*       ORIGINAL already selected and Done live, so one tap stored a         */
/*       judgement nobody had made of the attempt (the locked screen starts   */
/*       empty);                                                              */
/*    4. Stop left the recording screen up for the whole upload.              */
/* -------------------------------------------------------------------------- */
import { act, createElement, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeckChunkModal from "./DeckChunkModal";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { DualCaptureState } from "@/hooks/useDualCaptureMic";

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
vi.mock("@/services/api/mlc3FirstClient", async (load) => {
  const actual = await load<typeof import("@/services/api/mlc3FirstClient")>();
  return { ...actual, mlc3FirstClientPresentationEnabled: false };
});
vi.mock("@/services/api/takeFeedback", () => ({
  saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));

const practiceApi = vi.hoisted(() => ({
  startConfidencePractice: vi.fn(),
  uploadConfidencePracticeAttempt: vi.fn(),
  judgeConfidencePracticeAttempt: vi.fn(),
  finishConfidencePractice: vi.fn(async () => ({ ok: false, error: null })),
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

const attempt = {
  id: "att-1",
  attemptIndex: 1,
  audioRef: "https://example.test/att-1.webm",
  durationMs: 3000,
  assessment: "recorded_for_comparison",
  isStrongest: true,
  kept: false,
  userAnswer: null,
};
const openPractice = {
  id: "prac-1",
  status: "open",
  exercise: {
    exerciseId: "ex-1", version: 1, title: "Land the last word",
    instruction: "Say it again and land on the last word.",
    explanationVideoRef: null,
  },
  passage: "We should ship it now",
  originalAudioRef: null,
  originalStartOffsetMs: 0,
  originalDurationMs: 0,
  attempts: [],
  attemptsRemaining: 3,
  strongestAttempt: null,
  finalReady: false,
  finalMessage: null,
  finalQuestion: null,
  finalUserAnswer: null,
  selectedAttemptId: null,
  judgeableAttemptId: null,
};
const withAttempt = {
  ...openPractice,
  attempts: [attempt],
  attemptsRemaining: 2,
  strongestAttempt: attempt,
  judgeableAttemptId: attempt.id,
};

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
  practiceApi.uploadConfidencePracticeAttempt.mockReset();
  practiceApi.judgeConfidencePracticeAttempt.mockReset();
  practiceApi.startConfidencePractice.mockResolvedValue({ ok: true, practice: openPractice });
  practiceApi.uploadConfidencePracticeAttempt.mockResolvedValue({ ok: true, practice: withAttempt });
  practiceApi.judgeConfidencePracticeAttempt.mockResolvedValue({
    ok: true, practice: { ...withAttempt, status: "completed" }, outcome: "adopt",
    adopted: false, paragraph: null, attemptWords: "We should ship it now",
  });
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
const recording = () => container.querySelector('[data-testid="practice-recording"]');
const judgement = () => container.querySelector("[data-practice-judgement]");

async function openOnTheOffer() {
  await act(async () => {
    root.render(
      createElement(DeckChunkModal, {
        ...props,
        state: chunkStateFor(chunk(), { document: TEXT, suggestions: [item] }),
      }),
    );
  });
  await click("In-between");
  expect(offer()).not.toBeNull();
}

async function stopWithAudio() {
  await act(async () => {
    mic.set({
      status: "stopped", finalText: "", durationSec: 3,
      audioBlob: new Blob([new Uint8Array(2000)], { type: "audio/webm" }),
    });
  });
}

describe("the recording screen", () => {
  it("numbers the very first recording as attempt 1", async () => {
    await openOnTheOffer();
    await click("Practise");
    expect(mic.started).toBe(1);
    expect(recording()?.textContent).toContain("Attempt 1");
    expect(recording()?.textContent).not.toContain("Attempt 3");
  });

  it("comes down when the mic cannot start, and the offer says why", async () => {
    await openOnTheOffer();
    await click("Practise");
    expect(recording()).not.toBeNull();
    await act(async () => {
      mic.set({ status: "error", message: "Microphone access was refused.", code: "denied" });
    });
    expect(recording()).toBeNull();
    expect(offer()).not.toBeNull();
    expect(container.querySelector('[data-testid="exercise-error"]')?.textContent)
      .toBe("Microphone access was refused.");
    // The way on is still there: Practise, not a dead Stop.
    expect(buttons().map((b) => b.textContent?.trim())).toContain("Practise");
  });

  it("comes down when the practice cannot be opened, and the offer says why", async () => {
    practiceApi.startConfidencePractice.mockResolvedValue({
      ok: false, error: "This is turned off in your data choices.",
    });
    await openOnTheOffer();
    await click("Practise");
    await stopWithAudio();
    expect(recording()).toBeNull();
    expect(offer()).not.toBeNull();
    expect(container.querySelector('[data-testid="exercise-error"]')?.textContent)
      .toBe("This is turned off in your data choices.");
    expect(practiceApi.uploadConfidencePracticeAttempt).not.toHaveBeenCalled();
  });

  it("ends with Stop, not with the upload", async () => {
    let finishUpload: (value: unknown) => void = () => {};
    practiceApi.uploadConfidencePracticeAttempt.mockReturnValue(
      new Promise((resolve) => { finishUpload = resolve; }),
    );
    await openOnTheOffer();
    await click("Practise");
    await stopWithAudio();
    // The upload is in flight: the recording screen is gone and the offer's
    // pill waits, disabled, rather than a Stop that has nothing to stop.
    expect(recording()).toBeNull();
    expect(offer()).not.toBeNull();
    expect(button("Practise").disabled).toBe(true);
    await act(async () => { finishUpload({ ok: true, practice: withAttempt }); });
    expect(judgement()).not.toBeNull();
  });
});

describe("the practice judgement", () => {
  it("starts with no answer selected and Done disabled, then judges the attempt as picked", async () => {
    await openOnTheOffer();
    await click("Practise");
    await stopWithAudio();
    expect(judgement()).not.toBeNull();
    const pressed = Array.from(container.querySelectorAll('[aria-pressed="true"]'));
    expect(pressed).toHaveLength(0);
    expect(button("Done").disabled).toBe(true);

    await click("Not sure");
    expect(button("Done").disabled).toBe(false);
    await click("Done");
    expect(practiceApi.judgeConfidencePracticeAttempt).toHaveBeenCalledWith(
      "prac-1", "att-1", "not_sure",
    );
  });

  it("empties again for the next attempt after a No", async () => {
    practiceApi.judgeConfidencePracticeAttempt.mockResolvedValue({
      ok: true, practice: withAttempt, outcome: "again",
      adopted: false, paragraph: null, attemptWords: null,
    });
    await openOnTheOffer();
    await click("Practise");
    await stopWithAudio();
    await click("No — Not confident");
    await click("Done");
    // Back on the offer to practise again …
    expect(offer()).not.toBeNull();
    expect(buttons().map((b) => b.textContent?.trim())).toContain("Practise again");
    // … and the second attempt's judgement starts empty.
    const second = { ...attempt, id: "att-2", attemptIndex: 2 };
    practiceApi.uploadConfidencePracticeAttempt.mockResolvedValue({
      ok: true,
      practice: { ...withAttempt, attempts: [attempt, second], attemptsRemaining: 1, judgeableAttemptId: "att-2" },
    });
    await click("Practise again");
    expect(recording()?.textContent).toContain("Attempt 2");
    await stopWithAudio();
    expect(judgement()).not.toBeNull();
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect(button("Done").disabled).toBe(true);
  });
});
