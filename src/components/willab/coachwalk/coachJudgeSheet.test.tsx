// @vitest-environment jsdom
/* Screen 2 · Judge (founder 2026-09-30, A1; P2-9). Pins: the sheet is the
 * speaker's grammar with the coach's words; the five pills are the speaker's
 * five; nothing of the moment is on the sheet; the tap saves once and hands
 * off at once with the save in flight (C1, 2026-10-08), then reports the
 * save; a refusal is reported with its sentence. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CoachJudgeSheet from "./CoachJudgeSheet";

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

function mount(
  onJudged: (v: string) => void = () => {},
  more: { onSaved?: (read: unknown) => void; onSaveFailed?: (e: string) => void; failed?: string | null } = {},
): void {
  act(() => {
    root.render(
      createElement(CoachJudgeSheet, {
        snippetId: "s-1", pager, clip: null, onClose: () => {}, onJudged, ...more,
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

  it("saves once on tap and hands off at once, the save in flight (C1)", async () => {
    let resolve: (v: unknown) => void = () => {};
    saveStateRating.mockReturnValue(new Promise((r) => { resolve = r; }));
    const onJudged = vi.fn();
    const onSaved = vi.fn();
    mount(onJudged, { onSaved });
    click("No — Not confident");
    expect(saveStateRating).toHaveBeenCalledTimes(1);
    expect(saveStateRating.mock.calls[0][0]).toBe("s-1");
    expect(saveStateRating.mock.calls[0][1]).toMatchObject({ state_id: "confidence", value: "no" });
    expect(onJudged).toHaveBeenCalledWith("no");
    expect(onSaved).not.toHaveBeenCalled();
    await act(async () => { resolve({ ok: true }); });
    await flush();
    expect(onSaved).toHaveBeenCalledWith(null);
  });
});
