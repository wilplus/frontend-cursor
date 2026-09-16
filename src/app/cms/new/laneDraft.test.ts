// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

import {
  EXERCISE_STEPS,
  POST_STEPS,
  blankDraft,
  clampStep,
  clearDraft,
  loadDraft,
  saveDraft,
  slugify,
  stepsFor,
  type LaneDraft,
} from "./laneDraft";

/* -------------------------------------------------------------------------- */
/*  ONE ACTION PER SCREEN (founder 2026-09-16)                                 */
/*                                                                            */
/*  The CMS used to be one long two-column form. Adding an exercise now walks  */
/*  eight screens and adding a post six, each asking for one thing.            */
/*                                                                            */
/*  The rule that decides most of this file: an author who loses a lane        */
/*  halfway does not start again. So the draft survives navigation, a bad step */
/*  in the URL lands somewhere real, and every step knows what it needs before */
/*  it lets you past.                                                         */
/* -------------------------------------------------------------------------- */

const CLIENT = readFileSync("src/app/cms/new/page.client.tsx", "utf8");
const RECORD = readFileSync("src/app/cms/new/RecordStep.tsx", "utf8");
/** Source with comments stripped. The coach component EXPLAINS why the old
 *  label was wrong, so a bare `toContain` would trip over the explanation
 *  rather than the label. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const COACH = code("src/components/willab/CoachConfidencePracticeReview.tsx");

function full(over: Partial<LaneDraft> = {}): LaneDraft {
  return {
    ...blankDraft("exercise"),
    videoUrl: "https://cdn/x.webm",
    title: "Land the ending",
    exerciseId: "land-the-ending",
    tags: ["ending_compression"],
    opening: "Your endings drop away.",
    instruction: "Give the last three words their weight.",
    body: "Most people do not run out of breath.",
    slug: "land-the-ending",
    ...over,
  };
}

describe("the lanes are the shape the founder locked", () => {
  it("is eight steps for an exercise and six for a post", () => {
    expect(EXERCISE_STEPS).toHaveLength(8);
    expect(POST_STEPS).toHaveLength(6);
    expect(stepsFor("exercise")).toBe(EXERCISE_STEPS);
    expect(stepsFor("post")).toBe(POST_STEPS);
  });

  it("opens the exercise lane on the camera", () => {
    // "Sort of like adding tiktoks" — recording is step one, not a field
    // buried under the blog chores.
    expect(EXERCISE_STEPS[0].id).toBe("record");
  });

  it("keeps the opening line and the instruction on ONE screen", () => {
    // They are two fields because only the instruction reappears while the
    // speaker is recording — but they are one decision, so one screen.
    const words = EXERCISE_STEPS.find((s) => s.id === "words");
    expect(words).toBeTruthy();
    expect(EXERCISE_STEPS.some((s) => s.id === "opening")).toBe(false);
  });

  it("only lets cover and community be skipped", () => {
    const skippable = (steps: typeof EXERCISE_STEPS) =>
      steps.filter((s) => s.skippable).map((s) => s.id);
    expect(skippable(EXERCISE_STEPS)).toEqual(["cover"]);
    expect(skippable(POST_STEPS).sort()).toEqual(["community", "cover", "excerpt"]);
  });
});

describe("a step will not let you past what it needs", () => {
  const problemOf = (id: string, draft: LaneDraft) =>
    EXERCISE_STEPS.find((s) => s.id === id)!.problem(draft);

  it("passes a complete draft at every step", () => {
    const draft = full();
    for (const step of EXERCISE_STEPS) {
      expect(step.problem(draft), step.id).toBeNull();
    }
  });

  it("will not go past the camera without a video", () => {
    expect(problemOf("record", full({ videoUrl: "" }))).toMatch(/Record it/);
  });

  it("refuses an id that would route nothing", () => {
    // Matching is exact string comparison on the server. `Land The Ending`
    // would match no exercise, raise nothing, and route nothing.
    for (const bad of ["Land The Ending", "land the ending", "", "9lives"]) {
      expect(problemOf("name", full({ exerciseId: bad })), bad).toMatch(/Id:/);
    }
  });

  it("refuses an exercise that treats nothing", () => {
    expect(problemOf("fixes", full({ tags: [] }))).toMatch(/never offered/);
  });

  it("asks for both halves of the words screen", () => {
    expect(problemOf("words", full({ opening: "" }))).toMatch(/see first/);
    expect(problemOf("words", full({ instruction: " " }))).toMatch(/what they do/i);
  });

  it("says WHY the write-up is not optional", () => {
    // It is only here because the founder kept the coupling: an exercise goes
    // live on a published post. The message should say that rather than
    // sounding like blogging for its own sake.
    expect(problemOf("writeup", full({ body: "" }))).toMatch(/published post/);
  });
});

describe("the draft survives the lane", () => {
  beforeEach(() => clearDraft());

  it("round-trips through the store", () => {
    const draft = full({ title: "Land the ending" });
    saveDraft(draft);
    expect(loadDraft()).toEqual(draft);
  });

  it("restores a draft written by an older build", () => {
    // A field added since must not throw the author back to step one.
    window.sessionStorage.setItem(
      "willpower.cms.lane",
      JSON.stringify({ lane: "exercise", title: "Half a draft" }),
    );
    const restored = loadDraft();
    expect(restored?.title).toBe("Half a draft");
    expect(restored?.tags).toEqual([]);
  });

  it("returns null for junk rather than throwing", () => {
    for (const junk of ["{", "null", '{"lane":"nonsense"}', "[]"]) {
      window.sessionStorage.setItem("willpower.cms.lane", junk);
      expect(() => loadDraft()).not.toThrow();
      expect(loadDraft()).toBeNull();
    }
  });

  it("uploads the video immediately rather than holding a File", () => {
    // A File cannot be serialised, so keeping it until the last step would
    // mean a back-swipe on step six loses the recording.
    expect(RECORD).toContain("adminPresign");
    expect(RECORD).toContain("uploadToStorage");
    expect(CLIENT).toContain("videoUrl: url");
  });
});

describe("a bad URL lands somewhere real", () => {
  it("clamps the step into the lane", () => {
    expect(clampStep("exercise", 0)).toBe(1);
    expect(clampStep("exercise", 99)).toBe(8);
    expect(clampStep("post", 99)).toBe(6);
    expect(clampStep("exercise", "3")).toBe(3);
  });

  it("never throws on nonsense", () => {
    for (const junk of ["x", null, undefined, NaN, {}, []]) {
      expect(() => clampStep("post", junk)).not.toThrow();
      expect(clampStep("post", junk)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("slugify", () => {
  it("turns a title into an address and an id", () => {
    expect(slugify("Land the ending")).toBe("land-the-ending");
    expect(slugify("Land the ending", "_")).toBe("land_the_ending");
  });

  it("produces something legal, or nothing", () => {
    for (const title of ["  Loud   START  ", "9 lives", "!!!", "é accent"]) {
      const out = slugify(title);
      if (out) expect(out).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});

describe("the doors into the lane", () => {
  it("the coach panel links straight past the fork", () => {
    expect(COACH).toContain('href="/cms/new/exercise/1"');
    expect(COACH).toContain("Add to the library");
  });

  it("names the one-off for what it is", () => {
    // It never enters the catalogue and can never reach a second speaker.
    expect(COACH).toContain("Just for them");
    expect(COACH).not.toContain("Create new exercise");
  });

  it("bounces to the CMS when the tab has no password", () => {
    expect(CLIENT).toContain('router.replace("/cms")');
  });
});
