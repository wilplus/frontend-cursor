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

const { default: LibraryClient, exerciseChoice, praiseByCue, itemCaption, newExerciseDraft, pastFinalFor } = await import("./page.client");

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
const LABELS = new Map(ERRORS.map((e) => [e.errorId, e.label]));

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
const live = () => host.querySelector<HTMLElement>("[data-walk-stage] .walk-layer:not(.walk-ghost)")!;

describe("the pure parts", () => {
  it("an exercise's row: what it treats, its transcript, retired", () => {
    expect(exerciseChoice(LAND, LABELS)).toEqual({ value: "e:land-the-last-word", label: "Land the last word", subtitle: "Ending compression · transcribed" });
    expect(exerciseChoice(BREATH, LABELS).subtitle).toBe("Rushing · transcribing…");
    expect(exerciseChoice(SLOW, LABELS).subtitle).toBe("Ending compression · transcribed · retired");
    expect(itemCaption(SLOW, LABELS)).toBe("Treats: Ending compression · transcribed · retired");
  });

  it("the praise lines by cue, active ones only; no rewrite moves (Q-B13 A)", () => {
    expect(praiseByCue(LINES).map(([cue, lines]) => [cue, lines.length])).toEqual([["landed_ending", 2]]);
  });

  it("a new exercise is named by its instruction's first words and treats the one error", () => {
    const draft = newExerciseDraft("rushing", "  Take one full breath before the sentence and spend it. ");
    expect(draft.title).toBe("Take one full breath before the");
    expect(draft.exerciseId).toMatch(/^take-one-full-breath-before-the-[a-z0-9]+$/);
    expect(draft.instruction).toBe("Take one full breath before the sentence and spend it.");
    expect(draft).toMatchObject({ acousticProblemTags: ["rushing"], mainTarget: "rushing", active: true });
    expect(pastFinalFor("rushing", [LAND, BREATH, SLOW])).toBe("Take one full breath.");
    expect(pastFinalFor("ending_compression", [SLOW])).toBe(""); // retired ones do not lend their words
  });
});

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

describe("one exercise", () => {
  it("opens on its video and its instruction with the pencil; Done, Retire it", async () => {
    await render();
    act(() => q('[data-walk-choice="e:land-the-last-word"]')!.click());
    await tick();
    const s = live();
    expect(s.querySelector("[data-walk-back-label]")?.textContent).toBe("Library");
    expect(s.querySelector("h2")?.textContent).toBe("Land the last word");
    expect(s.querySelector("[data-walk-subtitle]")?.textContent).toBe("Treats: Ending compression · transcribed");
    expect(s.querySelector("[data-coach-video]")).not.toBeNull();
    expect(s.querySelector("[data-coach-words]")?.textContent).toBe(LAND.instruction);
    expect(s.querySelector('[data-testid="library-done"]')?.textContent).toBe("Done");
    expect(s.querySelector('[data-testid="library-retire"]')?.textContent).toBe("Retire it");
    expect(s.querySelector('[data-testid="library-bring-back"]')).toBeNull();
  });

  it("the pencil edits every word; Done saves the edited instruction", async () => {
    await render();
    act(() => q('[data-walk-choice="e:land-the-last-word"]')!.click());
    await tick();
    act(() => live().querySelector<HTMLElement>("[data-coach-words-pencil]")!.click());
    const field = live().querySelector<HTMLTextAreaElement>("[data-coach-words-field]")!;
    expect(field.value).toBe(LAND.instruction);
    expect(live().querySelector<HTMLButtonElement>('[data-testid="library-done"]')!.disabled).toBe(true);
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    act(() => { setter.call(field, "Slow down on the last word."); field.dispatchEvent(new Event("input", { bubbles: true })); });
    act(() => live().querySelector<HTMLElement>("[data-coach-words-pencil]")!.click());
    expect(live().querySelector("[data-coach-words]")?.textContent).toBe("Slow down on the last word.");
    act(() => live().querySelector<HTMLElement>('[data-testid="library-done"]')!.click());
    await tick();
    expect(saveCoachExercise).toHaveBeenCalledOnce();
    expect(saveCoachExercise.mock.calls[0][0]).toMatchObject({ exerciseId: "land-the-last-word", instruction: "Slow down on the last word." });
  });

  it("Retire it takes it out through the active endpoint; a retired one offers Bring it back", async () => {
    await render();
    act(() => q('[data-walk-choice="e:land-the-last-word"]')!.click());
    await tick();
    act(() => live().querySelector<HTMLElement>('[data-testid="library-retire"]')!.click());
    await tick();
    expect(setExerciseActive).toHaveBeenCalledWith("land-the-last-word", false);
    expect(host.querySelector("[data-walk-toast]")?.textContent).toBe("Retired");
    expect(live().querySelector('[data-testid="library-bring-back"]')?.textContent).toBe("Bring it back");
    expect(live().querySelector('[data-testid="library-retire"]')).toBeNull();
    expect(live().querySelector("[data-walk-subtitle]")?.textContent).toBe("Treats: Ending compression · transcribed · retired");
  });

  it("Bring it back refused (409) shows the backend's own sentence", async () => {
    setExerciseActive.mockResolvedValue({ ok: false, status: 409, code: "NEEDS_VIDEO", message: "add the exercise's video before bringing it back" });
    await render();
    act(() => q('[data-walk-choice="e:slow-finish"]')!.click());
    await tick();
    act(() => live().querySelector<HTMLElement>('[data-testid="library-bring-back"]')!.click());
    await tick();
    expect(setExerciseActive).toHaveBeenCalledWith("slow-finish", true);
    expect(live().querySelector('[role="alert"]')?.textContent).toBe("add the exercise's video before bringing it back");
  });

  it("the praise lines filed under one cue", async () => {
    await render();
    act(() => q('[data-walk-choice="p:landed_ending"]')!.click());
    await tick();
    const s = live();
    expect(s.querySelector("h2")?.textContent).toBe("landed the ending");
    expect(s.querySelector("[data-walk-subtitle]")?.textContent).toBe("Praise lines the library offers when the machine hears this");
    expect([...s.querySelectorAll("[data-walk-choice]")].map((e) => e.textContent)).toEqual([
      "You brought the ending down and let it sit.", "The last word landed.",
    ]);
  });
});

describe("New", () => {
  it("the kind, the words, the video, Save", async () => {
    await render();
    act(() => q('[data-testid="library-new"]')!.click());
    await tick();
    let s = live();
    expect(s.querySelector("[data-walk-back-label]")?.textContent).toBe("New");
    expect(s.querySelector("h2")?.textContent).toBe("What kind of error is it?");
    expect(s.querySelector("[data-walk-subtitle]")?.textContent).toBe("One error · the library offers it when the machine hears it");
    expect([...s.querySelectorAll("[data-walk-choice]")].map((e) => e.textContent)).toEqual(["Rushing", "Ending compression"]);
    expect(s.querySelector<HTMLButtonElement>('[data-testid="library-kind-next"]')!.disabled).toBe(true);
    act(() => s.querySelector<HTMLElement>('[data-walk-choice="rushing"]')!.click());
    act(() => live().querySelector<HTMLElement>('[data-testid="library-kind-next"]')!.click());
    await tick();
    s = live();
    expect(s.querySelector("h2")?.textContent).toBe("Your instruction");
    expect(s.querySelector("[data-walk-subtitle]")?.textContent).toBe("As a speaker will see it · the pencil edits every word");
    expect(s.querySelector("[data-coach-words]")?.textContent).toBe("Take one full breath."); // the library's own past final
    act(() => s.querySelector<HTMLElement>('[data-testid="library-words-next"]')!.click());
    await tick();
    s = live();
    expect(s.querySelector("h2")?.textContent).toBe("Your video");
    expect(s.querySelector("[data-walk-subtitle]")?.textContent).toBe("An exercise needs its video");
    expect(s.querySelector('[data-coach-video-box="idle"]')?.textContent).toBe("Camera");
    expect(s.querySelector('[data-testid="library-record"]')?.textContent).toBe("Record");
    act(() => s.querySelector<HTMLElement>('[data-testid="library-record"]')!.click());
    expect(recorder.start).toHaveBeenCalled();
  });

  it("Save sends the words with the clip to the library", async () => {
    const file = new File(["x"], "clip.webm", { type: "video/webm" });
    recorder.state = { status: "stopped", file, url: "blob:clip", elapsedSec: 20 };
    await render();
    act(() => q('[data-testid="library-new"]')!.click());
    await tick();
    act(() => live().querySelector<HTMLElement>('[data-walk-choice="ending_compression"]')!.click());
    act(() => live().querySelector<HTMLElement>('[data-testid="library-kind-next"]')!.click());
    await tick();
    act(() => live().querySelector<HTMLElement>('[data-testid="library-words-next"]')!.click());
    await tick();
    const s = live();
    expect(s.querySelector('[data-testid="library-save"]')?.textContent).toBe("Save");
    expect(s.querySelector("[data-walk-link]")?.textContent).toBe("Record again");
    act(() => s.querySelector<HTMLElement>('[data-testid="library-save"]')!.click());
    await tick();
    expect(saveCoachExerciseWithVideo).toHaveBeenCalledOnce();
    const [draft, sent] = saveCoachExerciseWithVideo.mock.calls[0];
    expect(sent).toBe(file);
    expect(draft).toMatchObject({ mainTarget: "ending_compression", instruction: "Slow down on the last three words." });
    expect(host.querySelector("[data-walk-toast]")?.textContent).toBe("Saved · in the library");
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
