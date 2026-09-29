// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  /coach/exercises rendered — exercise authoring in the coach panel          */
/*  (founder 2026-09-29, decision 4).                                          */
/*                                                                            */
/*  The source fences in coachExercises.test.ts prove the request's shape.    */
/*  This file renders the REAL component and proves what a grep cannot: that  */
/*  a new exercise cannot leave without its video, that the AI draft reaches  */
/*  the exercise only through the coach's own hands, and that the review's    */
/*  hand-off brings the coach back to the moment with the exercise attached.  */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listCoachExercises = vi.fn();
const saveCoachExercise = vi.fn();
const saveCoachExerciseWithVideo = vi.fn();
const draftExerciseScript = vi.fn();
const isCoach = { value: true };

vi.mock("@/components/willab/useUserProfile", () => ({
  useUserProfile: () => ({ isCoach: isCoach.value, loading: false, profile: null }),
}));
vi.mock("@/components/willab/LoadingState", () => ({ default: () => null }));
vi.mock("@/services/api/coachExercises", async (load) => {
  const actual = await load<typeof import("@/services/api/coachExercises")>();
  return {
    ...actual,
    listCoachExercises,
    saveCoachExercise,
    saveCoachExerciseWithVideo,
    draftExerciseScript,
  };
});

const { default: CoachExerciseAuthoringClient } = await import("./page.client");

const RUSHING = {
  errorId: "rushing", label: "Rushing", definition: "…", asks: "…",
  status: "detected" as const, detectorRef: "insufficient_pauses", observedBy: null, active: true,
};
const MUMBLE = {
  errorId: "trailing_mumble", label: "Trailing mumble", definition: "…", asks: "…",
  status: "observed" as const, detectorRef: null, observedBy: "coach-1", active: true,
};
const LAND_IT = {
  exerciseId: "land-it", title: "Land it", instruction: "Say the last word fully.",
  introductionCopy: "", explanationVideoUrl: "https://cdn/land-it.mp4",
  acousticProblemTags: ["rushing"], matchingCriteria: {}, active: true, version: 2,
  latestVersion: {
    version: 2, source: "coach_panel", transcriptStatus: "done" as const,
    aiDraftText: null, createdAt: null,
  },
};

let host: HTMLDivElement;
let root: Root;
const navigate = vi.fn();

beforeEach(() => {
  isCoach.value = true;
  window.history.replaceState({}, "", "/coach/exercises");
  listCoachExercises.mockReset().mockResolvedValue({
    ok: true, data: { exercises: [LAND_IT], speakingErrors: [RUSHING, MUMBLE] },
  });
  saveCoachExercise.mockReset();
  saveCoachExerciseWithVideo.mockReset();
  draftExerciseScript.mockReset();
  navigate.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function render() {
  await act(async () => {
    root.render(<CoachExerciseAuthoringClient navigate={navigate} />);
  });
}

function button(label: string): HTMLButtonElement {
  const found = [...host.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );
  if (!found) {
    throw new Error(
      `no button "${label}" — have: ${[...host.querySelectorAll("button")]
        .map((b) => JSON.stringify(b.textContent?.trim())).join(", ")}`,
    );
  }
  return found as HTMLButtonElement;
}

async function click(label: string) {
  await act(async () => { button(label).click(); });
}

async function type(placeholder: string, value: string) {
  const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[placeholder="${placeholder}"]`,
  );
  if (!field) throw new Error(`no field with placeholder "${placeholder}"`);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function chooseVideo(name = "clip.mp4") {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input");
  const file = new File([new Uint8Array([1, 2, 3])], name, { type: "video/mp4" });
  await act(async () => {
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  return file;
}

const text = () => host.textContent ?? "";

describe("who sees it", () => {
  it("renders nothing for a non-coach and never asks for the library", async () => {
    isCoach.value = false;
    await render();
    expect(text()).toContain("Nothing here.");
    expect(listCoachExercises).not.toHaveBeenCalled();
  });

  it("lists the library with each exercise's kept version and transcript state", async () => {
    await render();
    expect(text()).toContain("Land it");
    expect(text()).toContain("Version 2");
    expect(text()).toContain("Transcript ready");
    // Tags read as the error library's labels, not ids.
    expect(text()).toContain("Rushing");
  });
});

describe("a new exercise", () => {
  it("cannot be saved without its video, and is born through the video call with it", async () => {
    await render();
    await click("New exercise");
    await type("Title", "Land the ending");
    // The id follows the title until the coach types one.
    expect(host.querySelector<HTMLInputElement>('[placeholder="land-the-ending"]')?.value)
      .toBe("land-the-ending");
    await click("Rushing");
    // A merely-named error is not a button: it cannot be picked.
    expect(() => button("Trailing mumble")).toThrow();

    await click("Save");
    expect(text()).toContain("needs its video");
    expect(saveCoachExercise).not.toHaveBeenCalled();
    expect(saveCoachExerciseWithVideo).not.toHaveBeenCalled();

    saveCoachExerciseWithVideo.mockResolvedValue({
      ok: true,
      data: { exercise: { ...LAND_IT, exerciseId: "land-the-ending", title: "Land the ending", version: 1 }, version: 1, transcriptStatus: "pending" },
    });
    const file = await chooseVideo();
    await click("Save");
    expect(saveCoachExerciseWithVideo).toHaveBeenCalledTimes(1);
    const [draft, sent] = saveCoachExerciseWithVideo.mock.calls[0]!;
    expect(sent).toBe(file);
    expect(draft.exerciseId).toBe("land-the-ending");
    expect(draft.acousticProblemTags).toEqual(["rushing"]);
    expect(draft.aiDraftText).toBeNull();
    expect(text()).toContain("“Land the ending” is saved as version 1.");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("takes the AI draft into the script only through the coach's hands, and keeps it beside the final", async () => {
    await render();
    await click("New exercise");
    await click("Draft a script");
    expect(text()).toContain("Pick a speaking error first.");
    expect(draftExerciseScript).not.toHaveBeenCalled();

    await click("Rushing");
    draftExerciseScript.mockResolvedValue({
      ok: true, data: { draft: "Leave a breath before the last word.", modelVersion: "m-1" },
    });
    await click("Draft a script");
    expect(draftExerciseScript).toHaveBeenCalledWith({ errorIds: ["rushing"], title: "" });
    // Shown, not yet the exercise's words.
    expect(text()).toContain("Leave a breath before the last word.");
    expect(host.querySelector<HTMLTextAreaElement>('[placeholder="Script"]')?.value).toBe("");

    await click("Use this draft");
    expect(host.querySelector<HTMLTextAreaElement>('[placeholder="Script"]')?.value)
      .toBe("Leave a breath before the last word.");
    await type("Script", "Leave a breath before the last word, then land it.");
    await type("Title", "Land it, slower");
    saveCoachExerciseWithVideo.mockResolvedValue({
      ok: true, data: { exercise: { ...LAND_IT, title: "Land it, slower" }, version: 1, transcriptStatus: "pending" },
    });
    await chooseVideo();
    await click("Save");
    const [draft] = saveCoachExerciseWithVideo.mock.calls[0]!;
    expect(draft.instruction).toBe("Leave a breath before the last word, then land it.");
    expect(draft.aiDraftText).toBe("Leave a breath before the last word.");
    expect(draft.aiDraftModelVersion).toBe("m-1");
  });
});

describe("an existing exercise", () => {
  it("saves its words without a new video through the plain save, keeping its stored video", async () => {
    await render();
    await click("Edit");
    expect(text()).toContain("Edit “Land it”");
    await type("Script", "Say the last word fully, then stop.");
    saveCoachExercise.mockResolvedValue({
      ok: true, data: { exercise: { ...LAND_IT, version: 3 }, version: 3, transcriptStatus: null },
    });
    await click("Save");
    expect(saveCoachExerciseWithVideo).not.toHaveBeenCalled();
    const [draft] = saveCoachExercise.mock.calls[0]!;
    expect(draft.explanationVideoUrl).toBe("https://cdn/land-it.mp4");
    expect(draft.instruction).toBe("Say the last word fully, then stop.");
    expect(text()).toContain("“Land it” is saved as version 3.");
  });

  it("says the backend's refusal in its own words", async () => {
    await render();
    await click("Edit");
    saveCoachExercise.mockResolvedValue({
      ok: false, status: 400, code: "TAG_NOT_DETECTED",
      message: "these are not errors code can find yet: trailing_mumble.",
    });
    await click("Save");
    expect(text()).toContain("these are not errors code can find yet: trailing_mumble.");
  });
});

describe("the review's hand-off", () => {
  it("opens the form on arrival and returns the coach to the moment with the exercise attached", async () => {
    window.history.replaceState(
      {}, "",
      "/coach/exercises?new=1&returnTo=" + encodeURIComponent("/chat?review=take-1&piece=2&for=snip-7"),
    );
    await render();
    expect(text()).toContain("New exercise");
    expect(host.querySelector('[placeholder="Title"]')).not.toBeNull();
    await type("Title", "Land the ending");
    await click("Rushing");
    saveCoachExerciseWithVideo.mockResolvedValue({
      ok: true,
      data: { exercise: { ...LAND_IT, exerciseId: "land-the-ending", title: "Land the ending", version: 1 }, version: 1, transcriptStatus: "pending" },
    });
    await chooseVideo();
    await click("Save");
    expect(navigate).toHaveBeenCalledWith("/chat?review=take-1&piece=2&for=snip-7&attach=land-the-ending");
  });
});
