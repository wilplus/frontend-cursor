// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The corpus workbench labels on the Judge screen (founder 2026-09-30, B9;  */
/*  build plan P2-16: "one instrument in the product; the workbench's own     */
/*  chrome is deleted"). The import and the index stay.                       */
/*                                                                            */
/*  Pins, through the real page: an import opens the walk's Judge screen     */
/*  (its title, its ‹ position › bar, the one instrument) over the workbench; */
/*  none of the workbench's labelling chrome is left (piece dots, the         */
/*  "labelled" count, the note field, Back and Skip); an answer writes the    */
/*  ternary body and nothing else, moves to the next unlabelled piece in      */
/*  payload order, and after the last one returns to the workbench; a         */
/*  re-review piece still says so on its write.                               */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QueuePiece, TrainingImport } from "@/services/api/trainingCorpus";

const saveSpy = vi.fn();
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
  };
});
vi.mock("@/services/api/stateRatings", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/api/stateRatings")>();
  return { ...real, saveStateRating: (...args: unknown[]) => saveSpy(...args) };
});

import CorpusPageClient, { importRowStatus, nextUnlabelled } from "./page.client";

const IMPORT: TrainingImport = {
  sessionId: "sess-1", arcId: null, topic: "Board pitch", speakerLabel: "Jane Doe",
  createdAt: null, state: "done", queueCount: 3, detail: null, language: null,
};

function piece(id: string, transcript: string, over: Partial<QueuePiece> = {}): QueuePiece {
  return {
    reviewActId: id, snippetId: id, transcript, audioRef: null, startOffsetMs: 0, durationMs: 250,
    label: null, reReview: false, learningExposures: [], canonicalPosition: null,
    blindReview: null, mlc2BlindReview: null, ...over,
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

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  saveSpy.mockReset();
  saveSpy.mockResolvedValue({ ok: true });
  queue = THREE;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("the corpus labels on the Judge screen (B9, P2-16)", () => {
  it("an import opens the Judge screen over the workbench, on the first unlabelled piece", async () => {
    await openImport();
    expect(sheet()?.getAttribute("aria-label")).toBe("Judge this moment");
    expect(sheet()?.querySelector('[data-testid="coach-judge-sheet"] [data-testid="coach-judge-instrument"]')).not.toBeNull();
    expect(bar()).toContain("Board pitch · moment 1 of 3");
    expect(sheet()?.textContent).toContain("Does the speaker sound confident here?");
    // The workbench is still underneath: its import stays.
    expect(host.textContent).toContain("Training corpus");
  });

  it("none of the workbench's labelling chrome is left", async () => {
    await openImport();
    const dialog = sheet();
    expect(dialog?.querySelectorAll('button[aria-label^="Piece "]').length).toBe(0);
    expect(dialog?.textContent).not.toMatch(/labelled/);
    expect(dialog?.textContent).not.toContain("Anything worth remembering");
    expect(dialog?.querySelectorAll("input, textarea").length).toBe(0);
    expect([...(dialog?.querySelectorAll("button") ?? [])].some((b) => /^(Back|Skip)$/.test(b.textContent?.trim() ?? "")))
      .toBe(false);
    expect(host.querySelector('button[aria-label="Back to the corpus"]')).toBeNull();
  });

  it("an answer writes the ternary body only, then moves on in payload order", async () => {
    await openImport();
    answer("Yes — Confident");
    await flush();
    expect(saveSpy).toHaveBeenCalledTimes(1);
    const [snippetId, body] = saveSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(snippetId).toBe("piece-c");
    expect(Object.keys(body).sort()).toEqual(["idempotency_key", "state_id", "value"]);
    expect(body).toMatchObject({ state_id: "confidence", value: "yes" });
    // Past the piece already called, to the next unlabelled one (N2).
    expect(bar()).toContain("moment 3 of 3");
  });

  it("the bar walks back to a called piece, which shows its call and its words", async () => {
    await openImport();
    answer("Yes — Confident");
    await flush();
    click(host.querySelector('[data-testid="feedback-pager"] button[aria-label="Back"]'));
    await flush();
    expect(bar()).toContain("moment 2 of 3");
    expect(sheet()?.textContent).toContain("so we moved the launch");
    const pressed = [...(sheet()?.querySelectorAll('button[aria-pressed="true"]') ?? [])].map((b) => b.textContent?.trim());
    expect(pressed).toEqual(["Yes — Confident"]);
  });

  it("after the last unlabelled piece the sheet closes onto the workbench", async () => {
    await openImport();
    answer("Yes — Confident");
    await flush();
    answer("No — Not confident");
    await flush();
    expect(saveSpy).toHaveBeenCalledTimes(2);
    expect((saveSpy.mock.calls[1] as [string, Record<string, unknown>])[1]).toMatchObject({ value: "no" });
    expect(sheet()).toBeNull();
    expect(host.textContent).toContain("Training corpus");
  });

  it("a refused save keeps the sheet on the piece and says why", async () => {
    saveSpy.mockResolvedValue({ ok: false, error: "This clip no longer needs another blind rating." });
    await openImport();
    answer("In-between");
    await flush();
    expect(bar()).toContain("moment 1 of 3");
    expect(sheet()?.textContent).toContain("This clip no longer needs another blind rating.");
  });

  it("a re-review piece still says so on its write", async () => {
    queue = () => [piece("piece-r", "we will ship it", { reReview: true, label: null })];
    await openImport();
    answer("No — Not confident");
    await flush();
    expect((saveSpy.mock.calls[0] as [string, Record<string, unknown>])[1]).toMatchObject({ value: "no", re_review: true });
  });
});

describe("the pure halves", () => {
  it("the next unlabelled piece is ahead of the cursor only, never the one just saved", () => {
    const pieces = THREE();
    expect(nextUnlabelled(pieces, 0, "piece-c")).toBe(2);
    expect(nextUnlabelled(pieces, 2, "piece-b")).toBe(-1);
    expect(nextUnlabelled(pieces, 1, "piece-a")).toBe(2);
  });

  it("an import row says what the database holds, never a pending send", () => {
    const done = { state: "done" as const, queueCount: 9 };
    expect(importRowStatus(done, undefined)).toEqual({ status: "9 to label", complete: false });
    expect(importRowStatus(done, { labelled: 0, total: 9 })).toEqual({ status: "9 to label", complete: false });
    expect(importRowStatus(done, { labelled: 4, total: 9 })).toEqual({ status: "4 of 9 labelled", complete: false });
    expect(importRowStatus(done, { labelled: 9, total: 9 })).toEqual({ status: "All 9 labelled", complete: true });
    expect(importRowStatus(done, { labelled: 0, total: 0 })).toEqual({ status: "Nothing to label", complete: false });
    expect(importRowStatus({ state: "running", queueCount: null }, undefined).status).toBe("Analysing…");
    expect(importRowStatus({ state: "failed", queueCount: null }, undefined).status).toBe("Nothing to label");
    expect(importRowStatus({ state: "done", queueCount: null }, undefined).status).toBe("");
  });
});
