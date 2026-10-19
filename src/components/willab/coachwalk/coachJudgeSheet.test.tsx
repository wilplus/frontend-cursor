// @vitest-environment jsdom
/*
STORY    As a coach, I want the Judge sheet to show only the question and five
         answers and to save once on tap, so that I judge blind and move on
         fast.
OUTCOME
  O1  Never-2: the sheet holds the question, its caption and the five
      answers, and nothing else of the moment.
  O2  A tap saves once and hands off at once with the save in flight; the
      moment's read the save returns goes to the walk and is never painted
      on the Judge sheet.
  O3  A refused save brings the sheet back with the refusal's sentence and
      reports it; the next tap saves again.
PROVES   O1 -> "shows the coach's words, the speaker's five pills, and nothing of the moment"
         O2 -> "saves once on tap and hands off at once, the save in flight (C1)"
         O3 -> "reports a refused save with its sentence and lets the coach answer again"
WHY      Never-2 (BLIND COACH): the passage is withheld until the rating is saved.
*/
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

const PILLS = ["Yes — Confident", "In-between", "No — Not confident", "Not sure", "Audio unclear"];
const PASSAGE = "We grew forty percent last quarter.";

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
    for (const label of PILLS) {
      expect(text).toContain(label);
    }
    // No passage, no kind, no library name: only the question and its answers.
    const sheet = container.querySelector('[data-testid="coach-judge-sheet"]');
    expect(sheet?.textContent).toBe(
      ["Does the speaker sound confident here?", "Private · training · saved on tap", ...PILLS].join(""),
    );
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
    const momentRead = { passage: PASSAGE, speakerAnswer: "yes" };
    await act(async () => { resolve({ ok: true, momentRead }); });
    await flush();
    expect(onSaved).toHaveBeenCalledWith(momentRead);
    expect(container.textContent).toContain("Does the speaker sound confident here?");
    expect(container.textContent).not.toContain(PASSAGE);
  });

  it("reports a refused save with its sentence and lets the coach answer again", async () => {
    const sentence = "That answer did not save. Try again.";
    saveStateRating.mockResolvedValueOnce({ ok: false, error: sentence });
    const onSaveFailed = vi.fn();
    const onSaved = vi.fn();
    mount(() => {}, { onSaved, onSaveFailed });
    click("Yes — Confident");
    await flush();
    expect(onSaveFailed).toHaveBeenCalledWith(sentence);
    expect(onSaved).not.toHaveBeenCalled();
    expect(container.textContent).toContain(sentence);
    saveStateRating.mockResolvedValueOnce({ ok: true });
    click("Yes — Confident");
    await flush();
    expect(saveStateRating).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledWith(null);
  });
});
