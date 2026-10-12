// @vitest-environment jsdom
/* The founder's Library page (CP3 A; D-CP-21): its pure parts, and the
   screens as the prototype draws them (library, libitem, libpraise, libkind,
   libwords, libvideo), with Retire it / Bring it back on the active endpoint. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listCoachExercises = vi.fn();
const saveCoachExercise = vi.fn();
const saveCoachExerciseWithVideo = vi.fn();
const setExerciseActive = vi.fn();
const listCatalogue = vi.fn();
const isCoach = { value: true };
const recorder = { state: { status: "idle" } as { status: string; file?: File; url?: string; elapsedSec?: number }, previewStream: null, start: vi.fn(), stop: vi.fn(), reset: vi.fn() };

vi.mock("@/components/willab/useUserProfile", () => ({
  useUserProfile: () => ({ isCoach: isCoach.value, loading: false, profile: null }),
}));
vi.mock("@/components/willab/LoadingState", () => ({ default: () => null }));
vi.mock("@/services/api/coachExercises", async (load) => {
  const actual = await load<typeof import("@/services/api/coachExercises")>();
  return { ...actual, listCoachExercises, saveCoachExercise, saveCoachExerciseWithVideo, setExerciseActive };
});
vi.mock("@/services/api/coachWalk", async (load) => {
  const actual = await load<typeof import("@/services/api/coachWalk")>();
  return { ...actual, listCatalogue };
});
vi.mock("@/hooks/useCoachVideoRecorder", () => ({ useCoachVideoRecorder: () => recorder }));

const { default: LibraryClient } = await import("./LibraryPanel");

const LAND = {
  exerciseId: "land-the-last-word", title: "Land the last word", instruction: "Slow down on the last three words.",
  introductionCopy: "", explanationVideoUrl: "https://v/land.mp4", acousticProblemTags: ["ending_compression"],
  matchingCriteria: { primary_problem_tag: "ending_compression" }, active: true, version: 2,
  latestVersion: { version: 2, source: "coach", transcriptStatus: "done" as const, aiDraftText: null, createdAt: null },
};
const BREATH = { ...LAND, exerciseId: "one-breath", title: "One breath to the end", instruction: "Take one full breath.",
  acousticProblemTags: ["rushing"], matchingCriteria: { primary_problem_tag: "rushing" },
  latestVersion: { ...LAND.latestVersion, transcriptStatus: "pending" as const } };
const SLOW = { ...LAND, exerciseId: "slow-finish", title: "Slow finish", instruction: "Say only its last four words at half speed.", active: false };
const ERRORS = [
  { errorId: "rushing", label: "Rushing", definition: "d", asks: "q", status: "detected" as const, detectorRef: "x", observedBy: null, active: true },
  { errorId: "ending_compression", label: "Ending compression", definition: "d", asks: "q", status: "detected" as const, detectorRef: "x", observedBy: null, active: true },
  { errorId: "old", label: "Old", definition: "d", asks: "q", status: "observed" as const, detectorRef: null, observedBy: null, active: false },
];
const LINES = [
  { id: "l1", lane: "praise" as const, patternKind: "cue" as const, patternKey: "landed_ending", text: "You brought the ending down and let it sit.", version: 1, active: true, signedBy: null },
  { id: "l2", lane: "praise" as const, patternKind: "cue" as const, patternKey: "landed_ending", text: "The last word landed.", version: 1, active: true, signedBy: null },
  { id: "l3", lane: "praise" as const, patternKind: "cue" as const, patternKey: "landed_ending", text: "gone", version: 1, active: false, signedBy: null },
  { id: "m1", lane: "rewrite" as const, patternKind: "move" as const, patternKey: "drop_the_filler", text: "x", version: 1, active: true, signedBy: null },
];

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  isCoach.value = true;
  recorder.state = { status: "idle" };
  listCoachExercises.mockReset().mockResolvedValue({ ok: true, data: { exercises: [LAND, BREATH, SLOW], speakingErrors: ERRORS } });
  listCatalogue.mockReset().mockResolvedValue(LINES);
  saveCoachExercise.mockReset().mockResolvedValue({ ok: true, data: { exercise: LAND, version: 3, transcriptStatus: "done" } });
  saveCoachExerciseWithVideo.mockReset().mockResolvedValue({ ok: true, data: { exercise: LAND, version: 1, transcriptStatus: "pending" } });
  setExerciseActive.mockReset().mockResolvedValue({ ok: true, active: false, changed: true });
  window.history.replaceState(null, "", "/admin/library");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
async function render() {
  await act(async () => { root.render(<LibraryClient />); });
  await tick();
}
const q = (sel: string) => host.querySelector<HTMLElement>(sel);
const qa = (sel: string) => [...host.querySelectorAll<HTMLElement>(sel)];

describe("the library screen", () => {
  it("‹ Lounge, Your library, the exercises then the praise lines, the pinned New", async () => {
    await render();
    expect(q('[data-testid="library-lounge"]')?.getAttribute("href")).toBe("/chat");
    expect(q("h1")?.textContent).toBe("Your library");
    expect(qa("[data-walk-choice]").map((e) => e.textContent)).toEqual([
      "Land the last wordEnding compression · transcribed",
      "One breath to the endRushing · transcribing…",
      "Slow finishEnding compression · transcribed · retired",
      "landed the ending2 praise lines",
    ]);
    expect(q('[data-testid="library-new"]')?.textContent).toBe("New");
    expect(host.textContent).not.toMatch(/%|\bv\d\b/);
  });
});

describe("a non-coach", () => {
  it("renders nothing", async () => {
    isCoach.value = false;
    await render();
    expect(host.textContent).toBe("");
    expect(listCoachExercises).not.toHaveBeenCalled();
  });
});
