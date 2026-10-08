// @vitest-environment jsdom
/* Screen 2 · Judge (founder 2026-09-30, A1; P2-9). Pins: the sheet is the
 * speaker's grammar with the coach's words; the five pills are the speaker's
 * five; nothing of the moment is on the sheet; the tap saves once and hands
 * off only after the save returns; a refusal stays with its sentence. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CoachJudgeSheet from "./CoachJudgeSheet";
import { libraryLine, requestOpen } from "./CoachReadSheet";

const saveStateRating = vi.fn();
const prepareConfidenceChainPacket = vi.fn();
const acknowledgeConfidenceChainRender = vi.fn();
vi.mock("@/services/api/stateRatings", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/stateRatings")>(
    "@/services/api/stateRatings",
  );
  return {
    ...actual,
    saveStateRating: (...args: unknown[]) => saveStateRating(...args),
    prepareConfidenceChainPacket: (...args: unknown[]) => prepareConfidenceChainPacket(...args),
    acknowledgeConfidenceChainRender: (...args: unknown[]) =>
      acknowledgeConfidenceChainRender(...args),
  };
});

const pager = { index: 2, total: 4, label: "Quiet Heron", onBack: () => {}, onNext: () => {} };

let container: HTMLDivElement;
let root: Root;

function mount(onJudged: (v: string) => void = () => {}): void {
  act(() => {
    root.render(
      createElement(CoachJudgeSheet, {
        snippetId: "s-1", pager, clip: null, onClose: () => {}, onJudged,
      }),
    );
  });
}

function click(label: string): void {
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );
  if (!button) throw new Error(`no button ${label}`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

const flush = () => act(async () => { await Promise.resolve(); });

describe("CoachJudgeSheet", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    saveStateRating.mockReset();
    prepareConfidenceChainPacket.mockReset();
    acknowledgeConfidenceChainRender.mockReset();
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows the coach's words, the speaker's five pills, and nothing of the moment", () => {
    mount();
    const text = container.textContent ?? "";
    expect(text).toContain("Judge this moment");
    expect(text).toContain("Does the speaker sound confident here?");
    expect(text).toContain("Private · training · saved on tap");
    expect(text).toContain("Quiet Heron · moment 3 of 4");
    for (const label of ["Yes — Confident", "In-between", "No — Not confident", "Not sure", "Audio unclear"]) {
      expect(text).toContain(label);
    }
    // No passage, no kind, no library name: only the question and its answers.
    const sheet = container.querySelector('[data-testid="coach-judge-sheet"]');
    expect(sheet?.querySelectorAll("p").length ?? 0).toBeLessThanOrEqual(1);
    expect(sheet?.querySelectorAll("button").length).toBe(5);
  });

  it("saves once on tap and hands off only after the save returns", async () => {
    let resolve: (v: unknown) => void = () => {};
    saveStateRating.mockReturnValue(new Promise((r) => { resolve = r; }));
    const onJudged = vi.fn();
    mount(onJudged);
    click("No — Not confident");
    expect(saveStateRating).toHaveBeenCalledTimes(1);
    expect(saveStateRating.mock.calls[0][0]).toBe("s-1");
    expect(saveStateRating.mock.calls[0][1]).toMatchObject({ state_id: "confidence", value: "no" });
    expect(onJudged).not.toHaveBeenCalled();
    await act(async () => { resolve({ ok: true }); });
    await flush();
    expect(onJudged).toHaveBeenCalledWith("no");
  });

  it("a refused save stays on the sheet with the sentence", async () => {
    saveStateRating.mockResolvedValue({ ok: false, error: "Rate in a language you know." });
    const onJudged = vi.fn();
    mount(onJudged);
    click("Not sure");
    await flush();
    await flush();
    expect(container.textContent).toContain("Rate in a language you know.");
    expect(onJudged).not.toHaveBeenCalled();
  });
});

describe("CoachJudgeSheet on the confidence chain (N48.5 Q27 A)", () => {
  const handle = {
    reviewAssignmentId: "20000000-0000-4000-8000-000000000003",
    presentationId: "20000000-0000-4000-8000-000000000005",
    acknowledgementToken: "20000000-0000-4000-8000-000000000006",
    visiblePayloadSha256: "b".repeat(64),
  };
  const clip = { src: "https://media.example/take.webm", startOffsetMs: 1000, durationMs: 3000 };

  function mountWithClip(onJudged: (v: string) => void = () => {}): void {
    act(() => {
      root.render(
        createElement(CoachJudgeSheet, {
          snippetId: "s-1", pager, clip, onClose: () => {}, onJudged,
        }),
      );
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    saveStateRating.mockReset().mockResolvedValue({ ok: true });
    prepareConfidenceChainPacket.mockReset();
    acknowledgeConfidenceChainRender.mockReset();
    vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => {
      run(0);
      return 0;
    });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("asks for the packet only once the clip is on screen", () => {
    prepareConfidenceChainPacket.mockResolvedValue(null);
    mount();
    expect(prepareConfidenceChainPacket).not.toHaveBeenCalled();
  });

  it("receipts the painted packet and echoes it with the answer", async () => {
    prepareConfidenceChainPacket.mockResolvedValue(handle);
    acknowledgeConfidenceChainRender.mockResolvedValue({
      ok: true,
      receipt: { reviewAssignmentId: handle.reviewAssignmentId,
                 presentationId: handle.presentationId, exposureId: "exposure-9" },
    });
    mountWithClip();
    await flush();
    await flush();
    expect(prepareConfidenceChainPacket).toHaveBeenCalledWith("s-1");
    expect(acknowledgeConfidenceChainRender).toHaveBeenCalledTimes(1);
    const [acked, request] = acknowledgeConfidenceChainRender.mock.calls[0];
    expect(acked).toEqual(handle);
    expect(request.idempotencyKey).toContain(handle.presentationId);
    click("In-between");
    await flush();
    expect(saveStateRating.mock.calls[0][2]).toEqual({ handle, exposureId: "exposure-9" });
  });

  it("without a packet the answer is saved exactly as before and nothing shows", async () => {
    prepareConfidenceChainPacket.mockResolvedValue(null);
    mountWithClip();
    await flush();
    const before = container.textContent;
    click("Yes — Confident");
    await flush();
    expect(acknowledgeConfidenceChainRender).not.toHaveBeenCalled();
    expect(saveStateRating.mock.calls[0][2]).toBeNull();
    expect(container.textContent).toBe(before);
  });

  it("a refused receipt never reaches the answer or the screen", async () => {
    prepareConfidenceChainPacket.mockResolvedValue(handle);
    acknowledgeConfidenceChainRender.mockResolvedValue({ ok: false, error: "refused" });
    mountWithClip();
    await flush();
    await flush();
    click("Not sure");
    await flush();
    expect(saveStateRating.mock.calls[0][2]).toBeNull();
    expect(container.textContent).not.toContain("refused");
  });
});

describe("the Read screen's library line", () => {
  const base = {
    id: "r", reason: "nothing_targets_it" as const, kind: "error" as const, spotted: [],
    resolution: null, resolvedExerciseId: null, shared: false, offeredSince: false,
    availableExercises: [], candidates: [],
  };
  it("says in one sentence where the library stands", () => {
    expect(libraryLine(null)).toBe("Nothing reached you from this moment.");
    expect(libraryLine(base)).toBe("Nothing treats this yet.");
    expect(libraryLine({ ...base, availableExercises: [
      { exerciseId: "e", version: 1, title: "t", instruction: "", explanationVideoRef: null },
    ] })).toBe("The library has something for this.");
    expect(libraryLine({ ...base, offeredSince: true }))
      .toBe("The library matched it since; the speaker has that exercise.");
    expect(libraryLine({ ...base, resolution: "no_safe_match" })).toBe("You had nothing to add.");
    expect(libraryLine({ ...base, resolution: "exercise_chosen", shared: true }))
      .toBe("You answered this moment and shared it.");
  });
  it("only an unresolved request is open", () => {
    expect(requestOpen(null)).toBe(false);
    expect(requestOpen(base)).toBe(true);
    expect(requestOpen({ ...base, resolution: "no_safe_match" })).toBe(false);
  });
});
