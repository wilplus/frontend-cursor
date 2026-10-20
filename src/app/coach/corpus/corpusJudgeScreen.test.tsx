// @vitest-environment jsdom
/*
STORY    As a coach, I want an imported recording to open on the one Judge
         screen, save only my answer and move to the next unlabelled piece, so
         that judging is fast and blind.
OUTCOME
  O1  An import opens the walk's Judge screen and nothing of the workbench's
      labelling chrome (no note field, no Skip, no "labelled" count).
  O2  Never-2: before the coach answers, the sheet shows the question and
      the five answers, and no words of the piece, no id, URL, offset or
      window number.
  O3  An answer writes the ternary body only, then moves to the next
      unlabelled piece in payload order.
  O4  After the last unlabelled piece the sheet closes, back on the
      workbench.
  O5  A re-review piece still says so on its write.
PROVES   O1, O2 -> "opens on the Judge screen alone, blind: no chrome, no words, no id, URL or window"
         O3     -> "an answer writes the ternary body only, then moves on in payload order"
         O4     -> "after the last unlabelled piece the sheet closes, back on the workbench"
         O5     -> "a re-review piece says so on its write"
WHY      Never-2; founder 2026-09-30 B9 / P2-16 ("one instrument in the
         product; the workbench's own chrome is deleted").
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QueuePiece, TrainingImport } from "@/services/api/trainingCorpus";

const saveSpy = vi.fn();
const ackSpy = vi.fn();
const playbackSpy = vi.fn();
let queue: () => QueuePiece[] = () => [];

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/willab/useUserProfile", () => ({
  useUserProfile: () => ({ isCoach: true, loading: false, profile: { proficient_languages: ["en"] } }),
}));
vi.mock("@/hooks/useVisibleLearningExposure", () => ({ useVisibleLearningExposure: () => undefined }));
vi.mock("@/services/api/trainingCorpus", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/api/trainingCorpus")>();
  return {
    ...real,
    fetchTrainingImports: async () => [IMPORT],
    fetchConfidenceQueue: async () => ({ sessionId: IMPORT.sessionId, queue: queue() }),
    fetchCorpusClipPlayback: (...args: unknown[]) => playbackSpy(...args),
  };
});
vi.mock("@/services/api/stateRatings", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/api/stateRatings")>();
  return {
    ...real,
    saveStateRating: (...args: unknown[]) => saveSpy(...args),
    acknowledgeConfidenceChainRender: (...args: unknown[]) => ackSpy(...args),
  };
});

import CorpusPageClient from "./page.client";

const IMPORT: TrainingImport = {
  sessionId: "sess-1", arcId: null, topic: "Board pitch", speakerLabel: "Jane Doe",
  createdAt: null, state: "done", queueCount: 3, detail: null, language: null, setupComplete: true, labelledCount: null, archivedAt: null,
};

function piece(id: string, transcript: string, over: Partial<QueuePiece> = {}): QueuePiece {
  return {
    reviewActId: id, snippetId: id, transcript,
    label: null, reReview: false, learningExposures: [],
    mlc2BlindReview: null, ...over,
  };
}

const YES = { value: "yes" as const, unrateable: false, confident: true, intensity: null, note: null };

/** Payload order, as the server sends it (N2): an unlabelled piece, one the
 *  coach already called, another unlabelled one. */
const THREE = () => [
  piece("piece-c", "and we shipped it in a week"),
  piece("piece-a", "so we moved the launch", { label: YES }),
  piece("piece-b", "I think maybe we could"),
];

let host: HTMLDivElement;
let root: Root;

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); });
};
const sheet = () => host.querySelector<HTMLElement>('[role="dialog"]');
const bar = () => host.querySelector('[data-testid="feedback-pager"]')?.textContent ?? "";
function click(el: Element | null | undefined): void {
  if (!el) throw new Error("nothing to click");
  act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
}
function answer(label: string): void {
  click([...(sheet()?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.trim() === label));
}

async function openImport(): Promise<void> {
  await act(async () => { root.render(createElement(CorpusPageClient)); });
  await flush();
  click([...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Board pitch")));
  await flush();
}

/** The backend's playback answer for a row: a signed URL to the import's
 *  parent recording and the window to play from it. Each call signs anew. */
let signed = 0;
function playbackFor(snippetId: string) {
  signed += 1;
  return {
    ok: true as const,
    clip: {
      url: `https://media.example/imports/parent.wav?snippet=${snippetId}&sig=${signed}`,
      startOffsetMs: 61250,
      durationMs: 28400,
      expiresInS: 900,
    },
  };
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  saveSpy.mockReset();
  saveSpy.mockResolvedValue({ ok: true });
  signed = 0;
  playbackSpy.mockReset();
  playbackSpy.mockImplementation(async (id: string) => playbackFor(id));
  queue = THREE;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("the corpus labels on the Judge screen (B9, P2-16)", () => {

  it("an answer writes the ternary body only, then moves on in payload order", async () => {
    await openImport();
    answer("Yes — Confident");
    await flush();
    expect(saveSpy).toHaveBeenCalledTimes(1);
    const [snippetId, body, echo] = saveSpy.mock.calls[0] as [string, Record<string, unknown>, unknown];
    // No chain handle on the row, so nothing rides beside the label.
    expect(echo).toBeNull();
    expect(snippetId).toBe("piece-c");
    expect(Object.keys(body).sort()).toEqual(["idempotency_key", "state_id", "value"]);
    expect(body).toMatchObject({ state_id: "confidence", value: "yes" });
    // Past the piece already called, to the next unlabelled one (N2).
    expect(bar()).toContain("moment 3 of 3");
  });
});

describe("the Judge screen, before the answer", () => {

  it("opens on the Judge screen alone, blind: no chrome, no words, no id, URL or window", async () => {
    await openImport();
    const text = sheet()?.textContent ?? "";
    expect(text).toContain("Judge this moment");
    expect(text).toContain("Does the speaker sound confident here?");
    expect(bar()).toContain("moment 1 of 3");
    // The pager's ‹ ›, Close, the clip's player and the five answers: nothing else.
    const controls = [...(sheet()?.querySelectorAll("button, input, textarea, select") ?? [])]
      .map((el) => el.getAttribute("aria-label") || el.textContent?.trim());
    expect(controls.slice(-5)).toEqual(["Yes — Confident", "In-between", "No — Not confident", "Not sure", "Audio unclear"]);
    expect(controls).toHaveLength(9);
    expect(text).not.toMatch(/labelled|Skip/i);
    for (const leak of ["and we shipped it in a week", "piece-c", "media.example", "sig=", "61250", "61.25", "28400", "900", "1:01"]) {
      expect(text).not.toContain(leak);
    }
  });
});

describe("the end of the queue", () => {
  it("after the last unlabelled piece the sheet closes, back on the workbench", async () => {
    await openImport();
    answer("Yes — Confident");
    await flush();
    expect(saveSpy.mock.calls[0][0]).toBe("piece-c");
    answer("No — Not confident");
    await flush();
    expect(saveSpy).toHaveBeenCalledTimes(2);
    expect(saveSpy.mock.calls[1][0]).toBe("piece-b");
    expect(sheet()).toBeNull();
    expect(host.textContent).toContain("Board pitch");
  });

  it("a re-review piece says so on its write", async () => {
    queue = () => [piece("piece-r", "we said it again", { reReview: true })];
    await openImport();
    answer("Not sure");
    await flush();
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][1]).toMatchObject({ state_id: "confidence", value: "not_sure", re_review: true });
  });
});
