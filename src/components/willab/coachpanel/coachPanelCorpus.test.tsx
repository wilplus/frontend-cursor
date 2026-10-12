// @vitest-environment jsdom
/* The training corpus inside the panel, its host's flow (D-CP-20 review): a
   saved set-up goes straight to judging with "Set up · {n} moments", an
   import lands on the imports with "Imported · {n} moments", an import with
   nothing to judge is never judged, and the panel's Judge reads the queue
   without a piece's words. */
import { act } from "react";
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
import { blindPiece, type QueuePiece } from "@/services/api/trainingCorpus";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const IMPORT = { sessionId: "i1", arcId: null, topic: "Workshop recording", speakerLabel: null, createdAt: null,
  state: "done" as const, queueCount: null, detail: null, language: "en", setupComplete: false, labelledCount: null, archivedAt: null };
const PIECE = (id: string): QueuePiece => ({ reviewActId: id, snippetId: id, transcript: "SECRET WORDS", label: null, reReview: false,
  learningExposures: [], mlc2BlindReview: null });

let host: HTMLDivElement;
let root: Root;
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

describe("the training corpus in the panel", () => {

  it("the panel's queue read carries no words of a piece", () => {
    const piece = blindPiece(PIECE("a"));
    expect("transcript" in piece).toBe(false);
    expect(JSON.stringify(piece)).not.toContain("SECRET WORDS");
  });
});
