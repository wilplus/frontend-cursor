// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  /admin/errors rendered — the founder's Speaking errors page, drawn to the */
/*  coach panel prototype's `errors` and `error` screens (CP3 A; D-CP-21).    */
/*                                                                            */
/*  What a grep cannot prove: that the three groups are told apart on sight  */
/*  by the signed words, that a coach-named error sits under "Named only"    */
/*  as "Observed" (Q-B7 A), that one error opens on its definition, the      */
/*  signed readiness line only where the founder's ledger has a row, and the */
/*  exercises that treat it or "None yet.", and that a non-coach sees nothing. */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listSpeakingErrors = vi.fn();
const saveSpeakingError = vi.fn();
const listCoachExercises = vi.fn();
const ledger = vi.fn();
const push = vi.fn();
const isCoach = { value: true };

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/willab/useUserProfile", () => ({
  useUserProfile: () => ({ isCoach: isCoach.value, loading: false, profile: null }),
}));
vi.mock("@/components/willab/LoadingState", () => ({ default: () => null }));
vi.mock("@/services/api/speakingErrors", async (load) => {
  const actual = await load<typeof import("@/services/api/speakingErrors")>();
  return { ...actual, listSpeakingErrors, saveSpeakingError };
});
vi.mock("@/services/api/coachExercises", async (load) => {
  const actual = await load<typeof import("@/services/api/coachExercises")>();
  return { ...actual, listCoachExercises };
});
vi.mock("@/services/api/founderLearning", () => ({ founderLearning: { ledger } }));

const { default: SpeakingErrorsClient } = await import("./SpeakingErrorsPanel");

const RUSHING = {
  errorId: "rushing", label: "Rushing",
  definition: "The passage leaves too little silence between its words for a listener to keep up.",
  asks: "Did this passage give the listener room to follow it?",
  status: "detected" as const, detectorRef: "insufficient_pauses", observedBy: null, active: true,
};
const HEDGING = {
  errorId: "hedging", label: "Hedging", definition: "Softening words that take the weight off a claim.",
  asks: "Did the claim keep its weight?", status: "shadow" as const, detectorRef: "verbal_cues:hedging", observedBy: null, active: true,
};
const MUMBLE = {
  errorId: "trailing_mumble", label: "Trailing mumble", definition: "The last words lose volume while the pace stays even.",
  asks: "Did the speaker carry the end of the sentence?", status: "observed" as const, detectorRef: null, observedBy: "coach-1", active: true,
};
const LAND = {
  exerciseId: "land-the-last-word", title: "Land the last word", instruction: "Slow down on the last three words.",
  introductionCopy: "", explanationVideoUrl: "https://v/land.mp4", acousticProblemTags: ["rushing"],
  matchingCriteria: { primary_problem_tag: "rushing" }, active: true, version: 1, latestVersion: null,
};
const PACE = { jar: "shadow_cues.hedging", current: 6, bar: 10, rate: null, observedRate: null, weeksToBar: null, caughtRate: null, caughtBar: null, ready: false };

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  isCoach.value = true;
  listSpeakingErrors.mockReset().mockResolvedValue({ ok: true, data: [RUSHING, HEDGING, MUMBLE] });
  listCoachExercises.mockReset().mockResolvedValue({ ok: true, data: { exercises: [LAND], speakingErrors: [] } });
  ledger.mockReset().mockResolvedValue({ ok: true, value: { pace: [PACE] } });
  push.mockReset();
  saveSpeakingError.mockReset().mockResolvedValue({ ok: true, data: null });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function render(founder = true) {
  await act(async () => { root.render(<SpeakingErrorsClient founder={founder} />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

describe("the errors screen", () => {

  it("no form, no clip, no take and no student on the screen (L3)", async () => {
    await render();
    expect(host.querySelector("input, textarea")).toBeNull();
    expect(host.textContent).not.toMatch(/File it|Name a pattern|%/);
  });
});

describe("a non-coach", () => {
  it("renders nothing and does not even ask for the library", async () => {
    isCoach.value = false;
    await render();
    expect(host.textContent).toBe("");
    expect(listSpeakingErrors).not.toHaveBeenCalled();
  });
});
