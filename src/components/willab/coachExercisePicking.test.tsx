// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  FOUNDER 2026-09-25 — "it's just a list of exercises plus an add button".   */
/*                                                                            */
/*  The coach chooses which exercise sits on the moment the Feedback Manager  */
/*  picked. Four things are pinned here:                                      */
/*    1. every reviewed exercise is visible, with exactly one chosen;         */
/*    2. "Add to the library" goes through the review's hand-off when there   */
/*       is one, so the coach comes back to the same moment;                  */
/*    3. the exercise the CMS hands back is preselected on THAT moment only,  */
/*       and never saved on the coach's behalf;                               */
/*    4. one that comes back missing says so instead of failing silently.     */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AddToLibraryDoor,
  ExercisePickList,
  pendingAttachFor,
  useExerciseChoice,
} from "./coachExercisePicking";
import { withAttachedExercise } from "@/app/cms/interruptedDestination";
import type { CoachPracticeExercise } from "@/services/api/coachConfidencePractice";

const SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const EXERCISES: CoachPracticeExercise[] = [
  {
    exerciseId: "land-the-last-words",
    version: 1,
    title: "Land the last three words",
    instruction: "Slow down on the final three words.",
    explanationVideoRef: "https://cdn.example/land.mp4",
    isCustom: false,
  },
  {
    exerciseId: "one-breath",
    version: 2,
    title: "One breath per sentence",
    instruction: "",
    explanationVideoRef: null,
    isCustom: false,
  },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.history.replaceState({}, "", "/");
});

const radios = () =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));

/* ── the return address ─────────────────────────────────────────────────── */

describe("the CMS hands the new exercise back", () => {
  it("adds it to the return address, keeping the moment", () => {
    expect(
      withAttachedExercise("/chat?review=take-1&piece=3&for=snip-9", "land-the-last-words"),
    ).toBe("/chat?review=take-1&piece=3&for=snip-9&attach=land-the-last-words");
  });

  it("stays an in-app path whatever it is given", () => {
    // authoringReturnTo has already refused other origins; nothing added here
    // may turn the result into one.
    const out = withAttachedExercise("/chat?review=x", "a/../b?c=//evil.example");
    expect(out.startsWith("/chat?")).toBe(true);
    expect(out.startsWith("//")).toBe(false);
  });

  it("leaves the address alone when there is no id", () => {
    expect(withAttachedExercise("/chat?review=x", "   ")).toBe("/chat?review=x");
  });

  it("is what the exercise lane pushes on the way back, and only that lane", () => {
    const lane = read("app/cms/new/page.client.tsx");
    expect(lane).toContain("withAttachedExercise(back, draft.exerciseId)");
    expect(lane).toContain('draft.lane === "exercise"');
  });
});

describe("the review names the moment it hands off", () => {
  it("carries the clip, so the hand-back can only land on it", () => {
    const review = read("components/willab/CoachReviewOverlay.tsx");
    expect(review).toContain("&for=${encodeURIComponent(snippetId)}");
    // piece stays 1-based, so this still reopens the SAME moment.
    expect(review).toContain("&piece=${cursor + 1}");
  });
});

/* ── reading the hand-back ──────────────────────────────────────────────── */

describe("pendingAttachFor", () => {
  it("returns the exercise made for this moment", () => {
    expect(pendingAttachFor("?attach=one-breath&for=snip-1", "snip-1")).toBe("one-breath");
  });

  it("ignores one made for a different moment", () => {
    expect(pendingAttachFor("?attach=one-breath&for=snip-2", "snip-1")).toBeNull();
  });

  it("ignores one that does not say which moment it was for", () => {
    expect(pendingAttachFor("?attach=one-breath", "snip-1")).toBeNull();
  });

  it("refuses anything that is not a plausible exercise id", () => {
    expect(pendingAttachFor("?attach=%3Cscript%3E&for=snip-1", "snip-1")).toBeNull();
    expect(pendingAttachFor(`?attach=${"x".repeat(121)}&for=snip-1`, "snip-1")).toBeNull();
  });
});

/* ── the list ───────────────────────────────────────────────────────────── */

describe("ExercisePickList", () => {
  it("shows every reviewed exercise, with exactly the chosen one checked", () => {
    const onPick = vi.fn();
    act(() =>
      root.render(
        createElement(ExercisePickList, {
          exercises: EXERCISES,
          selectedId: "one-breath",
          onPick,
          notice: null,
        }),
      ),
    );
    expect(radios()).toHaveLength(2);
    expect(container.textContent).toContain("Land the last three words");
    expect(container.textContent).toContain("One breath per sentence");
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true"]);
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();
  });

  it("hands back the exercise that was tapped", () => {
    const onPick = vi.fn();
    act(() =>
      root.render(
        createElement(ExercisePickList, {
          exercises: EXERCISES,
          selectedId: "one-breath",
          onPick,
          notice: null,
        }),
      ),
    );
    act(() => radios()[0].click());
    expect(onPick).toHaveBeenCalledWith(EXERCISES[0]);
  });

  it("says a notice out loud when there is one", () => {
    act(() =>
      root.render(
        createElement(ExercisePickList, {
          exercises: EXERCISES,
          selectedId: "",
          onPick: vi.fn(),
          notice: "Not here yet.",
        }),
      ),
    );
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Not here yet.");
  });
});

/* ── the door ───────────────────────────────────────────────────────────── */

describe("AddToLibraryDoor", () => {
  it("goes through the review's hand-off when there is one", () => {
    const onBuild = vi.fn();
    act(() =>
      root.render(
        createElement(AddToLibraryDoor, {
          href: "/cms/new/exercise/1",
          snippetId: "snip-7",
          onBuild,
        }, "Add to the library"),
      ),
    );
    const button = container.querySelector("button");
    expect(button?.textContent).toBe("Add to the library");
    expect(container.querySelector("a")).toBeNull();
    act(() => button?.click());
    expect(onBuild).toHaveBeenCalledWith("snip-7");
  });

  it("stays the plain link where no review hosts the sheet", () => {
    act(() =>
      root.render(
        createElement(AddToLibraryDoor, {
          href: "/cms/new/exercise/1",
          snippetId: "snip-7",
        }, "Add to the library"),
      ),
    );
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/cms/new/exercise/1");
  });

  it("is wired into the sheet with the review's hand-off", () => {
    const card = read("components/willab/CoachSnippetReviewCard.tsx");
    expect(card).toContain("onBuildExercise={onBuildExercise}");
    const sheet = read("components/willab/CoachConfidencePracticeReview.tsx");
    expect(sheet).toContain("onBuild={onBuildExercise}");
  });
});

/* ── applying the hand-back ─────────────────────────────────────────────── */

function Harness({
  snippetId,
  practice,
  setters,
}: {
  snippetId: string;
  practice: { availableExercises: CoachPracticeExercise[] } | null;
  setters: Parameters<typeof useExerciseChoice>[2];
}) {
  useExerciseChoice(snippetId, practice, setters);
  return null;
}

function setters() {
  return {
    setMode: vi.fn(),
    setId: vi.fn(),
    setNotice: vi.fn(),
    setVideo: vi.fn(),
  };
}

describe("useExerciseChoice", () => {
  it("preselects the exercise the coach just made, on its own moment", () => {
    window.history.replaceState({}, "", "/chat?review=t&piece=2&for=snip-1&attach=land-the-last-words");
    const s = setters();
    act(() =>
      root.render(
        createElement(Harness, {
          snippetId: "snip-1",
          practice: { availableExercises: EXERCISES },
          setters: s,
        }),
      ),
    );
    expect(s.setMode).toHaveBeenCalledWith("library");
    expect(s.setId).toHaveBeenCalledWith("land-the-last-words");
    expect(s.setVideo).toHaveBeenCalledWith("https://cdn.example/land.mp4");
    expect(s.setNotice).toHaveBeenCalledWith(null);
  });

  it("forgets the hand-back, so a reload cannot apply it again", () => {
    window.history.replaceState({}, "", "/chat?review=t&piece=2&for=snip-1&attach=one-breath");
    act(() =>
      root.render(
        createElement(Harness, {
          snippetId: "snip-1",
          practice: { availableExercises: EXERCISES },
          setters: setters(),
        }),
      ),
    );
    const search = new URLSearchParams(window.location.search);
    expect(search.get("attach")).toBeNull();
    expect(search.get("for")).toBeNull();
    // The rest of the address — the review and the piece — is kept.
    expect(search.get("review")).toBe("t");
    expect(search.get("piece")).toBe("2");
  });

  it("says so when the exercise is not in the list, instead of doing nothing", () => {
    window.history.replaceState({}, "", "/chat?for=snip-1&attach=still-a-draft");
    const s = setters();
    act(() =>
      root.render(
        createElement(Harness, {
          snippetId: "snip-1",
          practice: { availableExercises: EXERCISES },
          setters: s,
        }),
      ),
    );
    expect(s.setId).not.toHaveBeenCalled();
    // Founder-approved wording, 2026-09-25.
    expect(s.setNotice).toHaveBeenCalledWith(
      "Exercise is not here yet. Publish it first, and then it will appear here!",
    );
  });

  it("never touches a different moment", () => {
    window.history.replaceState({}, "", "/chat?for=snip-OTHER&attach=one-breath");
    const s = setters();
    act(() =>
      root.render(
        createElement(Harness, {
          snippetId: "snip-1",
          practice: { availableExercises: EXERCISES },
          setters: s,
        }),
      ),
    );
    expect(s.setId).not.toHaveBeenCalled();
    expect(s.setNotice).not.toHaveBeenCalled();
    // And leaves it in place for the moment it belongs to.
    expect(new URLSearchParams(window.location.search).get("attach")).toBe("one-breath");
  });

  it("waits for the list before deciding anything", () => {
    window.history.replaceState({}, "", "/chat?for=snip-1&attach=one-breath");
    const s = setters();
    act(() =>
      root.render(createElement(Harness, { snippetId: "snip-1", practice: null, setters: s })),
    );
    expect(s.setId).not.toHaveBeenCalled();
    expect(s.setNotice).not.toHaveBeenCalled();
    expect(new URLSearchParams(window.location.search).get("attach")).toBe("one-breath");
  });

  it("never saves on the coach's behalf", () => {
    // Preselecting is all it does: the hook has no save, share or fetch.
    const picking = read("components/willab/coachExercisePicking.tsx");
    expect(picking).not.toMatch(/saveCoachConfidencePractice|fetch\(/);
  });
});
