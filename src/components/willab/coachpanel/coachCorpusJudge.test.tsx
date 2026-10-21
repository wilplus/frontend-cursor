// @vitest-environment jsdom
/*
STORY    As a coach judging the training corpus, I want each answer to move me
         on at once, so that judging is smooth even when saving is slow, and
         I never lose an answer the backend refused.
OUTCOME
  O1  An answer moves on to the next moment before its save comes back; the
      last one goes on to the next import.
  O2  A refused save takes the coach back to that moment with the backend's
      sentence; once the import is left, the panel is told instead.
PROVES   O1, O2 -> "an answer moves on at once, and a refused save comes back to its moment"
WHY      Founder 2026-10-21: judging the corpus one recording after another,
         smooth and fast (a label save took 9 s).
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchBlindConfidenceQueue = vi.fn();
const saveStateRating = vi.fn();
vi.mock("@/services/api/trainingCorpus", async (orig) => ({
  ...(await orig<typeof import("@/services/api/trainingCorpus")>()),
  fetchBlindConfidenceQueue: (...a: unknown[]) => fetchBlindConfidenceQueue(...a),
}));
vi.mock("@/services/api/stateRatings", async (orig) => ({
  ...(await orig<typeof import("@/services/api/stateRatings")>()),
  saveStateRating: (...a: unknown[]) => saveStateRating(...a),
}));
vi.mock("@/hooks/useCorpusClip", () => ({ useCorpusClip: () => ({ clip: null, error: null, onMediaError: () => undefined }) }));
vi.mock("@/hooks/useVisibleLearningExposure", () => ({ useVisibleLearningExposure: () => undefined }));
import { blindPiece } from "@/services/api/trainingCorpus";
import CoachCorpusJudge from "./CoachCorpusJudge";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PIECE = (id: string) => blindPiece({ reviewActId: id, snippetId: id, transcript: "", label: null, reReview: false,
  learningExposures: [], mlc2BlindReview: null });

/** A save held open until the test settles it. */
function heldSave() {
  let settle!: (r: { ok: boolean; error?: string | null }) => void;
  const promise = new Promise((resolve) => { settle = resolve; });
  return { promise, settle };
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  fetchBlindConfidenceQueue.mockReset().mockResolvedValue({ sessionId: "i1", queue: [PIECE("a"), PIECE("b")] });
  saveStateRating.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("judging an import's moments", () => {
  it("an answer moves on at once, and a refused save comes back to its moment", async () => {
    const first = heldSave();
    const second = heldSave();
    saveStateRating.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const onDone = vi.fn();
    const onSaveFail = vi.fn();
    act(() => root.render(<CoachCorpusJudge importId="i1" topic="Talk" onSaved={() => undefined} onSaveFail={onSaveFail}
      onDone={onDone} onBack={() => undefined} onClose={() => undefined} />));
    await wait(0);

    await answer("no");
    expect(saveStateRating).toHaveBeenLastCalledWith("a", expect.anything(), null);
    await answer("yes");
    // Both saves are still out: the coach went on to "b" and then past it.
    expect(saveStateRating).toHaveBeenLastCalledWith("b", expect.anything(), null);
    expect(onDone).toHaveBeenCalledTimes(1);

    await act(async () => { first.settle({ ok: false, error: "Could not save that answer." }); });
    expect(document.querySelector("[role='alert']")!.textContent).toBe("Could not save that answer.");
    saveStateRating.mockResolvedValueOnce({ ok: true });
    await answer("in_between");
    expect(saveStateRating).toHaveBeenLastCalledWith("a", expect.anything(), null);

    act(() => root.unmount());
    root = createRoot(host);
    await act(async () => { second.settle({ ok: false, error: "Could not save that answer." }); });
    expect(onSaveFail).toHaveBeenCalledWith("Could not save that answer.");
  });
});

const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
/** A face picked, and the hold before it counts. */
async function answer(value: string): Promise<void> {
  act(() => { document.querySelector<HTMLButtonElement>(`[data-walk-answer='${value}']`)!.click(); });
  await wait(320);
}
