// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE PRACTISE LOOP, DRIVEN END TO END (founder lock 2026-09-30, B6, D1,    */
/*  D2, Q4, Q5): Practise on the overlay opens the words to say; Stop ends    */
/*  the attempt; the five answers judge it; No, Not sure or Audio unclear     */
/*  record the next attempt, however many; Yes or In-between open the picker  */
/*  over the attempt's own words, and "Use these helper words" saves them and */
/*  locks the paragraph. The paragraph text never changes.                    */
/* -------------------------------------------------------------------------- */
import { act, createElement, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenChunkSheet from "./OpenChunkSheet";
import { passageOf } from "./PractiseSheet";
import { forgetParagraphSheetData } from "./paragraphSheetData";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { DualCaptureState } from "@/hooks/useDualCaptureMic";
import { fetchOwnerAnswers } from "@/services/api/bookmarkHistory";

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
vi.mock("@/hooks/useExerciseRenderedAck", () => ({
  useExerciseRenderedAck: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({
  default: (props: { label?: string | null }) =>
    createElement("div", { "data-testid": "media-player" }, props.label ?? ""),
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
vi.mock("@/services/api/bookmarkHistory", () => ({
  fetchOwnerAnswers: vi.fn(async () => [{ feedbackId: "s-cv", response: "no" }]),
  fetchParagraphHistory: vi.fn(async () => null),
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

const TEXT = "We should ship it now because the data is clear and the team is ready.";

const moment = {
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
  practiceExercise: null,
  evidence: {
    projectId: "arc-1", takeSessionId: "take-1", slideIndex: 0,
    paragraphIndex: 0, start: 0, end: 21,
  },
} as unknown as DocumentSuggestion;

const rewrite = {
  id: "s-rw",
  start: 22,
  end: 47,
  quote: "because the data is clear",
  kind: "replace",
  proposedText: "because the numbers back it",
  device: null,
  status: null,
  feedbackFamily: "rewrite_clarity",
  takeSessionId: "take-1",
} as unknown as DocumentSuggestion;

const withExercise = {
  ...moment,
  practiceExercise: {
    exerciseId: "ex-1", version: 1, title: "Land the last word",
    instruction: "Say it again and land on the last word.",
    introduction: "", yesIntroduction: "", noIntroduction: "",
    explanationVideoRef: "https://example.test/ex.mp4",
    passage: "We should ship it now", practiceId: null, resume: false,
    doneBefore: false, chosenByCoach: false,
  },
} as unknown as DocumentSuggestion;

const attempt = {
  id: "att-1", attemptIndex: 1, audioRef: "https://example.test/att-1.webm",
  durationMs: 3000, assessment: "recorded_for_comparison", isStrongest: true,
  kept: false, userAnswer: null,
};
const openPractice = {
  id: "prac-1", status: "open", kind: "rewrite",
  exercise: { exerciseId: "rewrite", version: 0, title: "", instruction: "", explanationVideoRef: null },
  passage: "because the numbers back it",
  originalAudioRef: null, originalStartOffsetMs: 0, originalDurationMs: 0,
  attempts: [], attemptsRemaining: 3, strongestAttempt: null,
  finalReady: false, finalMessage: null, finalQuestion: null,
  finalUserAnswer: null, selectedAttemptId: null, judgeableAttemptId: null,
};
const withAttempt = {
  ...openPractice, attempts: [attempt], strongestAttempt: attempt,
  judgeableAttemptId: attempt.id,
};
const withTenAttempts = {
  ...openPractice,
  attempts: Array.from({ length: 10 }, (_, i) => ({ ...attempt, id: `att-${i + 1}`, attemptIndex: i + 1 })),
  judgeableAttemptId: "att-10",
};

const lockIn = vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null }));
const saved = vi.fn();
const done = vi.fn();
const close = vi.fn();

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  forgetParagraphSheetData();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mic.state = { status: "idle" };
  mic.started = 0;
  practiceApi.startConfidencePractice.mockReset();
  practiceApi.uploadConfidencePracticeAttempt.mockReset();
  practiceApi.judgeConfidencePracticeAttempt.mockReset();
  practiceApi.savePracticeHelperWords.mockClear();
  practiceApi.startConfidencePractice.mockResolvedValue({ ok: true, practice: openPractice });
  practiceApi.uploadConfidencePracticeAttempt.mockResolvedValue({ ok: true, practice: withAttempt });
  practiceApi.judgeConfidencePracticeAttempt.mockResolvedValue({
    ok: true, practice: { ...withAttempt, status: "completed" }, outcome: "done",
    adopted: false, paragraph: null, attemptWords: "because the numbers back it",
  });
  lockIn.mockClear();
  saved.mockClear();
  done.mockClear();
  close.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const buttons = () => Array.from(container.querySelectorAll("button"));
const labels = () => buttons().map((b) => (b.textContent ?? "").trim());
async function click(label: string) {
  const found = buttons().find((b) => (b.textContent ?? "").trim() === label);
  if (!found) throw new Error(`no button labelled "${label}"`);
  await act(async () => {
    found.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
const sheet = () => container.querySelector('[data-testid="practise-sheet"]');
const say = () => container.querySelector('[data-testid="practise-say"]');
const recording = () => container.querySelector('[data-testid="practice-recording"]');
const judgement = () => container.querySelector("[data-practice-judgement]");

async function open(items: DocumentSuggestion[], pending: string[] = []) {
  const s = chunkStateFor(
    {
      part: { id: "p1", text: TEXT, locked: false },
      paragraphIndex: 0,
      start: 0,
      end: TEXT.length,
      status: "clean",
      pendingIds: pending,
      approvedIds: [],
      decidedIds: items.filter((i) => !pending.includes(i.id)).map((i) => i.id),
    } as DeckChunk,
    { document: TEXT, suggestions: items },
  );
  await act(async () => {
    root.render(
      createElement(OpenChunkSheet, {
        state: s,
        arcId: "arc-1",
        takeSessionId: "take-1",
        headline: null,
        onUseHelperWords: vi.fn(async () => true),
        onDone: done,
        onClose: close,
        practiseHost: { onLockIn: lockIn, onHelperWordsSaved: saved },
        renderSheet: () => createElement("div", { "data-testid": "judgement-sheet" }),
      }),
    );
  });
}

async function stopWithAudio() {
  await act(async () => {
    mic.set({
      status: "stopped", finalText: "", durationSec: 3,
      audioBlob: new Blob([new Uint8Array(2000)], { type: "audio/webm" }),
    });
  });
}

describe("what a card sends to practise (D1)", () => {
  it("the rewrite practises the clearer version, the plain moment its own words, the exercise its passage", () => {
    const rw = passageOf({ kind: "rewrite", item: rewrite, text: "because the numbers back it" });
    expect(rw.passage).toEqual({ kind: "rewrite", passage: "because the numbers back it", feedbackId: "s-rw" });
    expect(rw.heading).toBe("Say it this way");
    const plain = passageOf({ kind: "plain", item: moment, text: "We should ship it now", coach: false });
    expect(plain.passage).toEqual({ kind: "plain", feedbackId: "s-cv" });
    expect(plain.heading).toBe("Say it again");
    const ex = passageOf({ kind: "exercise", item: withExercise, video: "v", instruction: "Land it.", passage: "We should ship it now" });
    expect(ex.passage).toEqual({ kind: "exercise" });
    expect(ex.heading).toBe("Land it.");
    expect(ex.video).toBe("v");
  });
});

describe("the practise loop from the overlay", () => {
  it("Practise on a No with a rewrite opens the words to say, one record button and Skip; no judgement label (Q4)", async () => {
    await open([moment, rewrite], [rewrite.id]);
    expect(container.querySelector('[data-testid="practise-card"]')?.getAttribute("data-kind")).toBe("rewrite");
    await click("Practise");
    expect(sheet()).not.toBeNull();
    expect(say()?.textContent).toContain("Say it this way");
    expect(say()?.textContent).toContain("because the numbers back it");
    expect(say()?.textContent).toContain("Attempt 1");
    expect(say()?.textContent).not.toContain("Your judgement");
    expect(labels()).toContain("Practise");
    expect(labels()).toContain("Skip");
    expect(labels()).not.toContain("Not now");
  });

  it("records, stops, judges; a No records the next attempt with clean answers (D2, Q5)", async () => {
    await open([moment, rewrite], [rewrite.id]);
    await click("Practise");
    await click("Practise"); // record
    expect(recording()).not.toBeNull();
    expect(recording()?.textContent).toContain("because the numbers back it");
    expect(labels()).toContain("Stop");
    await stopWithAudio();
    expect(practiceApi.startConfidencePractice).toHaveBeenCalledTimes(1);
    expect(practiceApi.startConfidencePractice.mock.calls[0][4]).toEqual({
      kind: "rewrite", passage: "because the numbers back it", feedbackId: "s-rw",
    });
    expect(judgement()).not.toBeNull();
    expect(container.querySelector('[data-testid="practise-passage"]')?.textContent).toBe("because the numbers back it");
    expect(container.querySelector('[data-testid="media-player"]')?.textContent).toContain("attempt 1");
    // No: another attempt, and the chips start empty again.
    practiceApi.judgeConfidencePracticeAttempt.mockResolvedValueOnce({
      ok: true, practice: { ...withAttempt, judgeableAttemptId: null }, outcome: "again",
      adopted: false, paragraph: null, attemptWords: null,
    });
    await click("No — Not confident");
    expect(judgement()).toBeNull();
    expect(say()?.textContent).toContain("Attempt 2");
    expect(done).not.toHaveBeenCalled();
  });

  it("attempt 11 works like attempt 1: no cap (D2)", async () => {
    practiceApi.startConfidencePractice.mockResolvedValue({ ok: true, practice: withTenAttempts });
    await open([moment, rewrite], [rewrite.id]);
    await click("Practise");
    await click("Practise");
    await stopWithAudio();
    // The upload's practice (one attempt in this fixture) numbers the next.
    expect(practiceApi.uploadConfidencePracticeAttempt).toHaveBeenCalledTimes(1);
    expect(judgement()).not.toBeNull();
  });

  it("Yes on an attempt opens the picker over the attempt's words; Use these helper words saves, locks and moves on (B6)", async () => {
    await open([moment, rewrite], [rewrite.id]);
    await click("Practise");
    await click("Practise");
    await stopWithAudio();
    await click("Yes — Confident");
    expect(container.textContent).toContain("Choose your helper words");
    expect(container.textContent).toContain("From your attempt");
    expect(container.textContent).toContain("0 of 4 words");
    const use = container.querySelector('[data-testid="practise-use-words"]') as HTMLButtonElement;
    expect(use.disabled).toBe(true);
    const numbers = buttons().find((b) => b.textContent === "numbers")!;
    await act(async () => numbers.click());
    expect(container.textContent).toContain("1 of 4 words");
    await act(async () => use.click());
    expect(practiceApi.savePracticeHelperWords).toHaveBeenCalledWith("prac-1", "p1", "numbers");
    // The lock commits the paragraph as it is: no attempt rewrites it (L1).
    expect(lockIn).toHaveBeenCalledWith(TEXT);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("Not sure on an attempt is another attempt, not the picker (B2)", async () => {
    practiceApi.judgeConfidencePracticeAttempt.mockResolvedValueOnce({
      ok: true, practice: { ...withAttempt, judgeableAttemptId: null }, outcome: "again",
      adopted: false, paragraph: null, attemptWords: null,
    });
    await open([moment, rewrite], [rewrite.id]);
    await click("Practise");
    await click("Practise");
    await stopWithAudio();
    await click("Not sure");
    expect(container.textContent).not.toContain("Choose your helper words");
    expect(say()).not.toBeNull();
  });

  it("Skip moves on without any practice write", async () => {
    await open([moment], []);
    expect(container.querySelector('[data-testid="practise-card"]')?.getAttribute("data-kind")).toBe("plain");
    await click("Practise");
    expect(say()?.textContent).toContain("Say it again");
    await click("Skip");
    expect(practiceApi.startConfidencePractice).not.toHaveBeenCalled();
    expect(practiceApi.finishConfidencePractice).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("an exercise shows its video and instruction above the words", async () => {
    await open([withExercise], []);
    await click("Practise");
    expect(say()?.querySelector("video")?.getAttribute("src")).toBe("https://example.test/ex.mp4");
    expect(say()?.textContent).toContain("Say it again and land on the last word.");
    expect(say()?.textContent).toContain("We should ship it now");
  });

  it("In-between on the overlay: Next with Practise as the link, which opens the same loop (Q1 B)", async () => {
    vi.mocked(fetchOwnerAnswers).mockResolvedValueOnce([{ feedbackId: "s-cv", response: "in_between" }]);
    await open([moment, rewrite], [rewrite.id]);
    expect(labels()).toContain("Next");
    const link = container.querySelector('[data-testid="paragraph-sheet-practise"]') as HTMLButtonElement;
    expect(link.textContent).toBe("Practise");
    await act(async () => link.click());
    expect(sheet()).not.toBeNull();
  });
});
