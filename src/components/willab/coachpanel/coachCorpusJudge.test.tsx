// @vitest-environment jsdom
/*
STORY    As a coach judging the training corpus, I want the clips mixed across
         recordings and each answer to move me on at once, so that judging is
         smooth even when saving is slow, and I never lose an answer the
         backend refused.
OUTCOME
  O1  An answer moves on to the next clip before its save comes back; the
      judging screen names the clip's recording.
  O2  A refused save takes the coach back to that clip with the backend's
      sentence; once the judging is left, the panel is told instead.
  O3  A round's last clip brings the next round once its saves are in,
      starting with the opened recording only the first time; a clip
      answered in this sitting is never served again; when none is left,
      back to the list (N101).
PROVES   O1, O2 -> "an answer moves on at once, and a refused save comes back to its clip"
         O3 -> "a round's end brings the next round, and the list when none is left"
WHY      Founder 2026-10-21: smooth and fast (a label save took 9 s); the
         clips really mixed across speakers and the machine's reads (N101).
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMixedCorpusQueue = vi.fn();
const saveStateRating = vi.fn();
vi.mock("@/services/api/trainingCorpus", async (orig) => ({
  ...(await orig<typeof import("@/services/api/trainingCorpus")>()),
  fetchMixedCorpusQueue: (...a: unknown[]) => fetchMixedCorpusQueue(...a),
}));
vi.mock("@/services/api/stateRatings", async (orig) => ({
  ...(await orig<typeof import("@/services/api/stateRatings")>()),
  saveStateRating: (...a: unknown[]) => saveStateRating(...a),
}));
vi.mock("@/hooks/useCorpusClip", () => ({ useCorpusClip: () => ({ clip: null, error: null, onMediaError: () => undefined }) }));
vi.mock("@/hooks/useVisibleLearningExposure", () => ({ useVisibleLearningExposure: () => undefined }));
import { blindPiece, type MixedQueuePiece } from "@/services/api/trainingCorpus";
import CoachCorpusJudge from "./CoachCorpusJudge";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PIECE = (id: string): MixedQueuePiece => ({
  ...blindPiece({ reviewActId: id, snippetId: id, transcript: "", label: null, reReview: false,
    learningExposures: [], mlc2BlindReview: null }),
  topic: `FOSDEM · g-${id}`,
});

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
  fetchMixedCorpusQueue.mockReset().mockResolvedValue([PIECE("a"), PIECE("b"), PIECE("c")]);
  saveStateRating.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function judge(onDone = vi.fn(), onSaveFail = vi.fn()) {
  act(() => root.render(<CoachCorpusJudge startId="i1" topic="Talk" onSaved={() => undefined} onSaveFail={onSaveFail}
    onDone={onDone} onBack={() => undefined} onClose={() => undefined} />));
  return { onDone, onSaveFail };
}

describe("judging the training corpus, mixed", () => {
  it("an answer moves on at once, and a refused save comes back to its clip", async () => {
    const first = heldSave();
    const second = heldSave();
    saveStateRating.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { onSaveFail } = judge();
    await wait(0);
    expect(fetchMixedCorpusQueue).toHaveBeenCalledWith("i1");
    expect(document.body.textContent).toContain("FOSDEM · g-a");

    await answer("no");
    expect(saveStateRating).toHaveBeenLastCalledWith("a", expect.anything(), null);
    await answer("yes");
    // Both saves are still out: the coach went on to "b" and then to "c".
    expect(saveStateRating).toHaveBeenLastCalledWith("b", expect.anything(), null);
    expect(document.body.textContent).toContain("FOSDEM · g-c");

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

  it("a round's end brings the next round, and the list when none is left", async () => {
    const held = heldSave();
    fetchMixedCorpusQueue
      .mockResolvedValueOnce([PIECE("a")])
      // The backend may still list "a" while its save lands: never again.
      .mockResolvedValueOnce([PIECE("a"), PIECE("b")])
      .mockResolvedValueOnce([]);
    saveStateRating.mockReturnValueOnce(held.promise).mockResolvedValue({ ok: true });
    const { onDone } = judge();
    await wait(0);

    await answer("yes");
    // The round waits for its save before the next one is read.
    expect(fetchMixedCorpusQueue).toHaveBeenCalledTimes(1);
    await act(async () => { held.settle({ ok: true }); });
    await wait(0);
    expect(fetchMixedCorpusQueue.mock.calls).toEqual([["i1"], [null]]);
    expect(document.body.textContent).toContain("FOSDEM · g-b");

    await answer("no");
    expect(saveStateRating).toHaveBeenLastCalledWith("b", expect.anything(), null);
    await wait(0);
    expect(fetchMixedCorpusQueue.mock.calls).toEqual([["i1"], [null], [null]]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
/** A face picked, and the hold before it counts. */
async function answer(value: string): Promise<void> {
  act(() => { document.querySelector<HTMLButtonElement>(`[data-walk-answer='${value}']`)!.click(); });
  await wait(320);
}
