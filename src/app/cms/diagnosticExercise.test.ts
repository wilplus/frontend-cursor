import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* -------------------------------------------------------------------------- */
/*  A CATALOGUE OF MORE THAN ONE (founder 2026-09-16)                          */
/*                                                                            */
/*  "I will add the exercises… this would need to be dynamic."                 */
/*                                                                            */
/*  Until today this screen saved one hardcoded exercise, `hear-every-word-v1`,*/
/*  always claiming all three problem tags. Two things followed: a second      */
/*  exercise could not exist, and had one existed both would have claimed      */
/*  everything — so tag overlap would score them identically and matching      */
/*  would return an order that chose nothing. A catalogue of one hid that.     */
/* -------------------------------------------------------------------------- */

const CLIENT = readFileSync("src/services/api/journalAdmin.ts", "utf8");
const SECTION = readFileSync("src/app/cms/DiagnosticExerciseSection.tsx", "utf8");

describe("nothing about an exercise is hardcoded any more", () => {
  it("does not pin the exercise id", () => {
    expect(CLIENT).not.toContain('exercise_id: "hear-every-word-v1"');
    expect(CLIENT).toContain("exercise_id: exercise.exerciseId");
    expect(SECTION).not.toContain('"hear-every-word-v1"');
  });

  it("does not pin the problem tags", () => {
    // The line that made every exercise claim every problem.
    expect(CLIENT).not.toMatch(
      /acoustic_problem_tags:\s*\[\s*"rushing"/,
    );
    expect(CLIENT).toContain(
      "acoustic_problem_tags: exercise.acousticProblemTags",
    );
  });

  it("stops sending the knobs the backend can default", () => {
    // A CMS screen should not have to know these exist to save an exercise.
    // Scoped to the SAVE body on purpose: the read mapper still parses these
    // fields back off the server, and should.
    const save = CLIENT.slice(CLIENT.indexOf("export function adminSaveDiagnosticExercise"));
    const body = save.slice(0, save.indexOf("}, (data)"));
    for (const gone of [
      "matching_criteria",
      "exclusions",
      "supported_confidence_patterns",
      "version",
    ]) {
      expect(body, `still sends ${gone}`).not.toContain(gone);
    }
  });
});

describe("the tag picker is wired to the error library", () => {
  it("reads the library rather than a local list", () => {
    expect(SECTION).toContain("adminListSpeakingErrors");
    expect(CLIENT).toContain('post("speaking-errors/list"');
  });

  it("separates what is detectable from what is only named", () => {
    // Tagging a named-only error would match no recording, raise nothing and
    // route nothing. The author has to be able to see which is which.
    expect(SECTION).toContain("errors.filter((e) => e.detected)");
    expect(SECTION).toContain("errors.filter((e) => !e.detected)");
    expect(SECTION).toContain("no detector yet, so these cannot be picked");
  });

  it("only makes the detectable ones clickable", () => {
    // The named-only group renders as <span>, never <button> — unpickable by
    // construction rather than by a disabled attribute someone can drop.
    const namedOnly = SECTION.slice(SECTION.indexOf("namedOnly.map"));
    const untilClose = namedOnly.slice(0, namedOnly.indexOf("</div>"));
    expect(untilClose).toContain("<span");
    expect(untilClose).not.toContain("<button");
    expect(untilClose).not.toContain("onClick");
  });

  it("treats an unreadable status as NOT detected", () => {
    // Fail closed in the direction that matters: offering a named-only error
    // as pickable invites a tag that silently routes nothing.
    expect(CLIENT).toContain('detected: r.status === "detected"');
  });

  it("refuses to save an exercise that treats nothing", () => {
    expect(SECTION).toContain("tags.length === 0");
    expect(SECTION).toContain("never offered");
  });
});

describe("the id an author does not have to think about", () => {
  it("derives from the name and matches the backend shape", () => {
    expect(SECTION).toContain("suggestId");
    // Mirrors EXERCISE_ID_SHAPE in services/diagnostic_exercise_catalogue.py.
    expect(SECTION).toContain("/^[a-z][a-z0-9_-]{1,62}$/");
  });

  it("says whether saving creates or updates", () => {
    expect(SECTION).toContain("Creates a new exercise.");
    expect(SECTION).toContain("Updates the existing exercise.");
  });
});
