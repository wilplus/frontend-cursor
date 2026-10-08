// @vitest-environment jsdom
/* The training corpus inside the panel, its host's flow (D-CP-20 review): a
   saved set-up goes straight to judging with "Set up · {n} moments", an
   import lands on the imports with "Imported · {n} moments", an import with
   nothing to judge is never judged, and the panel's Judge reads the queue
   without a piece's words. */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchTrainingImports = vi.fn();
const saveImportSetup = vi.fn();
const fetchBlindConfidenceQueue = vi.fn();
const importTrainingAudio = vi.fn();
vi.mock("@/services/api/trainingCorpus", async (orig) => ({
  ...(await orig<typeof import("@/services/api/trainingCorpus")>()),
  fetchTrainingImports: (...a: unknown[]) => fetchTrainingImports(...a),
  saveImportSetup: (...a: unknown[]) => saveImportSetup(...a),
  fetchBlindConfidenceQueue: (...a: unknown[]) => fetchBlindConfidenceQueue(...a),
  importTrainingAudio: (...a: unknown[]) => importTrainingAudio(...a),
}));
vi.mock("@/services/api/coachPanel", () => ({
  fetchErrorAudit: vi.fn(async () => null),
  fetchBlockPicks: vi.fn(async () => null),
}));
vi.mock("../coachwalk/useConfidenceChainReceipt", () => ({ useConfidenceChainReceipt: () => ({ current: null }) }));
vi.mock("./CoachCorpusJudge", () => ({
  default: ({ importId }: { importId: string }) => <div data-testid="stub-corpus-judge">{importId}</div>,
}));

import CoachPanel from "./CoachPanel";
import { PANEL_START, panelReducer, type PanelAction, type PanelState } from "@/lib/willab/coachPanel";
import { blindPiece, type QueuePiece } from "@/services/api/trainingCorpus";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const IMPORT = { sessionId: "i1", arcId: null, topic: "Workshop recording", speakerLabel: null, createdAt: null,
  state: "done" as const, queueCount: null, detail: null, language: "en", setupComplete: false, labelledCount: null, archivedAt: null };
const PIECE = (id: string): QueuePiece => ({ reviewActId: id, snippetId: id, transcript: "SECRET WORDS", label: null, reReview: false,
  learningExposures: [], mlc2BlindReview: null });

let host: HTMLDivElement;
let root: Root;
let latest: PanelState;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  fetchTrainingImports.mockReset().mockResolvedValue([IMPORT]);
  saveImportSetup.mockReset().mockResolvedValue({ ok: true });
  fetchBlindConfidenceQueue.mockReset();
  importTrainingAudio.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const live = () => document.querySelector<HTMLElement>("[data-walk-stage] .walk-layer:not(.walk-ghost)")!;

function Host({ start }: { start: PanelState }) {
  const [state, setState] = useState(start);
  latest = state;
  const dispatch = (a: PanelAction) => setState((s: PanelState) => panelReducer(s, a));
  return <CoachPanel state={state} dispatch={dispatch} speakers={[]} loading={false} onHandover={() => {}} />;
}

async function openSetUp() {
  act(() => root.render(<Host start={panelReducer(PANEL_START, { type: "corpus" })} />));
  await flush();
  act(() => live().querySelector<HTMLElement>('[data-walk-choice="i1"]')!.click());
  await flush();
  expect(latest.screen).toEqual({ key: "corpusimport", setupOf: "i1" });
}

describe("the training corpus in the panel", () => {
  it("a saved set-up goes straight to judging, with Set up · {n} moments, and no way back to the set-up", async () => {
    fetchBlindConfidenceQueue.mockResolvedValue({ sessionId: "i1", queue: [blindPiece(PIECE("a")), blindPiece(PIECE("b")), blindPiece(PIECE("c"))] });
    await openSetUp();
    await act(async () => { live().querySelector<HTMLElement>('[data-testid="corpus-submit"]')!.click(); });
    await flush();
    expect(saveImportSetup).toHaveBeenCalledWith("i1", expect.objectContaining({ topic: "Workshop recording", language: "en" }));
    expect(latest.screen).toEqual({ key: "corpus", importId: "i1", topic: "Workshop recording" });
    expect(latest.history).toEqual([]);
    expect(document.querySelector("[data-walk-toast]")!.textContent).toBe("Set up · 3 moments");
  });

  it("a set-up with nothing to judge lands on the imports, never on a Judge screen", async () => {
    fetchBlindConfidenceQueue.mockResolvedValue({ sessionId: "i1", queue: [] });
    await openSetUp();
    await act(async () => { live().querySelector<HTMLElement>('[data-testid="corpus-submit"]')!.click(); });
    await flush();
    expect(latest.screen.key).toBe("corpushome");
    expect(document.querySelector('[data-testid="stub-corpus-judge"]')).toBeNull();
  });

  it("a refused set-up returns to its screen with the backend's own sentence", async () => {
    saveImportSetup.mockResolvedValue({ ok: false, error: "topic: required" });
    await openSetUp();
    await act(async () => { live().querySelector<HTMLElement>('[data-testid="corpus-submit"]')!.click(); });
    await flush();
    expect(latest.screen).toEqual({ key: "corpusimport", setupOf: "i1" });
    expect(live().querySelector('[role="alert"]')!.textContent).toBe("topic: required");
    expect(fetchBlindConfidenceQueue).not.toHaveBeenCalled();
  });

  it("the panel's queue read carries no words of a piece", () => {
    const piece = blindPiece(PIECE("a"));
    expect("transcript" in piece).toBe(false);
    expect(JSON.stringify(piece)).not.toContain("SECRET WORDS");
  });
});
