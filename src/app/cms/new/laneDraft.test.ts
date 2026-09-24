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
  it("is nine steps for an exercise and six for a post", () => {
    // Nine since 2026-09-23: `where` joined at position two.
    expect(EXERCISE_STEPS).toHaveLength(9);
    expect(POST_STEPS).toHaveLength(6);
    expect(stepsFor("exercise")).toBe(EXERCISE_STEPS);
    expect(stepsFor("post")).toBe(POST_STEPS);
  });

  it("asks where it goes straight after the camera", () => {
    // Position two, not the end: the answer REMOVES four later screens, and
    // asking last would mean walking a cover picker for a declined post.
    expect(EXERCISE_STEPS[1].id).toBe("where");
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

  it("names exactly the steps an author may walk past", () => {
    const skippable = (steps: typeof EXERCISE_STEPS) =>
      steps.filter((s) => s.skippable).map((s) => s.id);
    // `words` joined `cover` on 2026-09-24 ("that is not obligatory!"): an
    // exercise may demonstrate rather than describe. The video did NOT join
    // them and must not.
    expect(skippable(EXERCISE_STEPS).sort()).toEqual(["cover", "words"]);
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

  it("asks for neither half of the words screen", () => {
    // Was "asks for both halves" until 2026-09-24. Both are optional now;
    // the screen stays, so an author who wants to write them still can.
    expect(problemOf("words", full({ opening: "" }))).toBeNull();
    expect(problemOf("words", full({ instruction: " " }))).toBeNull();
  });

  it("still refuses an EMPTY write-up once you have asked for one", () => {
    // REWRITTEN 2026-09-23. This used to assert the message named the
    // coupling ("an exercise goes live on a published post"), because the
    // write-up was compulsory. It no longer is — you decline it on the `where`
    // screen. What survives is the narrower rule: having ASKED for a post, you
    // cannot ship a blank one to the public journal.
    expect(problemOf("writeup", full({ body: "" }))).toBeTruthy();
    expect(problemOf("writeup", full({ body: "Something." }))).toBeNull();
  });

  it("and the screen is simply gone when the write-up was declined", () => {
    // The stronger guarantee: not "an empty post is refused" but "there is no
    // post screen to be empty".
    expect(stepsFor(full({ publishPost: false })).some((s) => s.id === "writeup"))
      .toBe(false);
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
    expect(clampStep("exercise", 99)).toBe(9);
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

  it("bounces to the CMS when the tab has no password, carrying where it was going", () => {
    // It used to bounce to a bare /cms, which dropped the lane, the step and
    // the returnTo — so a coach sent to the record screen resumed at the
    // Post-or-Exercise fork (founder 2026-09-24). The destination now rides
    // the bounce and /cms resumes it after unlocking.
    expect(CLIENT).toContain("/cms?next=");
    expect(CLIENT).not.toContain('router.replace("/cms")');
  });
});


describe("the ticks decide how long the lane is", () => {
  const POST_ONLY = ["writeup", "cover", "details"];

  it("keeps the post screens when the write-up is kept", () => {
    const ids = stepsFor(full({ publishPost: true })).map((s) => s.id);
    for (const id of POST_ONLY) expect(ids).toContain(id);
    expect(ids).toHaveLength(9);
  });

  it("drops exactly the post screens when it is declined", () => {
    const ids = stepsFor(full({ publishPost: false })).map((s) => s.id);
    for (const id of POST_ONLY) expect(ids).not.toContain(id);
    expect(ids).toEqual(["record", "where", "name", "fixes", "words", "publish"]);
  });

  it("still ends on Ready, so an exercise without a post can still ship", () => {
    // The point of the change. If this lane could not finish, the tick would
    // mean "saved and never offered" — the outcome the founder rejected.
    const steps = stepsFor(full({ publishPost: false }));
    expect(steps[steps.length - 1].id).toBe("publish");
  });

  it("clamps a URL step into the SHORTENED lane", () => {
    // Someone deep in the lane who unticks the write-up must not land on a
    // screen that no longer exists.
    expect(clampStep(full({ publishPost: false }), 9)).toBe(6);
    expect(clampStep(full({ publishPost: true }), 9)).toBe(9);
  });

  it("a fresh lane publishes, so the Lane-only callers still work", () => {
    expect(stepsFor("exercise")).toHaveLength(9);
  });
});

describe("the Ready screen promises only what will be written", () => {
  // The last screen before publishing is the worst place to be wrong about
  // what publishing does. Asserted on the source because ReviewStep renders
  // rows rather than exporting them.
  const REVIEW = code("src/app/cms/new/LaneSteps.tsx");

  it("does not list a Post row unconditionally", () => {
    expect(REVIEW).toContain("draft.publishPost");
    expect(REVIEW).toContain("none — video and instruction only");
  });

  it("shows the setup label when the avatar tick is set", () => {
    expect(REVIEW).toContain("Avatar set");
  });
});

describe("the avatar tick cannot be a tick alone", () => {
  const whereProblem = (draft: LaneDraft) =>
    EXERCISE_STEPS.find((s) => s.id === "where")!.problem(draft);

  it("lets you past with nothing ticked but the exercise", () => {
    expect(whereProblem(full({ avatarEligible: false }))).toBeNull();
  });

  it("will not go past a ticked avatar with no setup named", () => {
    // A bare yes says this clip was shot carefully; it cannot say two clips
    // MATCH, and matching is the whole requirement of a training set.
    const problem = whereProblem(
      full({ avatarEligible: true, avatarSetupLabel: "" }),
    );
    expect(problem).toBeTruthy();
    expect(problem).toContain("setup");
  });

  it("treats whitespace as no label", () => {
    expect(whereProblem(full({ avatarEligible: true, avatarSetupLabel: "   " })))
      .toBeTruthy();
  });

  it("passes once the setup is named", () => {
    expect(
      whereProblem(full({ avatarEligible: true, avatarSetupLabel: "desk-white-shirt" })),
    ).toBeNull();
  });
});

describe("the words step does not block the lane", () => {
  /* Founder 2026-09-24, on "The words": "that is not obligatory!"
   *
   * A video is required and always was, so what this allows is an exercise
   * that DEMONSTRATES rather than describes. The backend stopped requiring
   * the same two fields in the same change — relaxing only here would have
   * moved the refusal to the end of a nine-screen lane. */
  const words = EXERCISE_STEPS.find((s) => s.id === "words");

  it("still exists as a screen", () => {
    expect(words).toBeTruthy();
    expect(words!.heading).toBe("The words");
  });

  it("raises no problem when both fields are blank", () => {
    expect(words!.problem(full({ opening: "", instruction: "" }))).toBeNull();
  });

  it("is marked skippable, like the cover step", () => {
    expect(words!.skippable).toBe(true);
  });

  it("leaves the video requirement alone", () => {
    // The one thing an exercise cannot go live without. If this ever goes
    // too, "exercise" means a title and nothing else.
    const record = EXERCISE_STEPS.find((s) => s.id === "record");
    expect(record!.problem(full({ videoUrl: "" }))).toBeTruthy();
  });
});
