import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* -------------------------------------------------------------------------- */
/*  SEPARATION TEST — the N1 fence for the star-verdict surface, in code       */
/*                                                                            */
/*  The star-verdict surface SHOWS the machine's guesses (that is its job:     */
/*  the coach judges whether each star should have fired). The blind labeling  */
/*  flow (CoachSnippetReviewCard's Direction chips, hosted by                  */
/*  CoachReviewOverlay) must never see a machine guess — §S.3 label hygiene.   */
/*  Putting the two on one screen would anchor the blind label, so the spec's  */
/*  N1 demands a separate screen and a separate navigation entry.              */
/*                                                                            */
/*  Intent does not survive refactors; an import graph test does. Same         */
/*  discipline as the Life Panel's isolation test. If this file is red, the    */
/*  branch does not merge.                                                     */
/* -------------------------------------------------------------------------- */

const SRC = join(fileURLToPath(new URL("../../", import.meta.url)));

/** The blind labeling flow: the labeler card, its host overlay, the readout
 *  block inside the card, and the fetch hook. (Shared primitives like
 *  OverlayCloseButton / useBackDismiss are NOT the flow — both sides may use
 *  them freely.) */
const LABELER_FILES = [
  join("components", "willab", "CoachSnippetReviewCard.tsx"),
  join("components", "willab", "CoachReviewOverlay.tsx"),
  join("components", "willab", "SnippetReadoutBlock.tsx"),
  join("components", "willab", "useCoachReview.ts"),
];

/** The star-verdict lane. */
const OVERLAY = join("components", "willab", "CoachStarVerdictOverlay.tsx");
const SERVICE = join("services", "api", "starVerdicts.ts");

/** Everything permitted to import the star-verdict lane. The Lounge is the
 *  hub that mounts every overlay as siblings — the ONE file allowed to know
 *  both flows. The detail/roster screens carry the entry callback (a plain
 *  prop, no star imports needed — listed here only for the overlay, which
 *  they never import today; tightening later is fine). */
const PERMITTED_OVERLAY_IMPORTERS = [join("components", "willab", "Lounge.tsx")];
const PERMITTED_SERVICE_IMPORTERS = [OVERLAY];

/** Matches an import of the lane from anywhere (alias or relative). */
const STAR_LANE_IMPORT =
  /from\s+["'](?:@\/services\/api\/starVerdicts|(?:\.{1,2}\/)+(?:services\/api\/)?starVerdicts|\.\/CoachStarVerdictOverlay|@\/components\/willab\/CoachStarVerdictOverlay)["']/;

const OVERLAY_IMPORT =
  /from\s+["'](?:\.\/CoachStarVerdictOverlay|@\/components\/willab\/CoachStarVerdictOverlay)["']/;
const SERVICE_IMPORT =
  /from\s+["'](?:@\/services\/api\/starVerdicts|(?:\.{1,2}\/)+(?:services\/api\/)?starVerdicts)["']/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Test fixtures under app/dev — exempt from the importer fence ONLY because
 *  a later test asserts every one of them renders nothing in production
 *  (same bargain the Life Panel's isolation test strikes). The fence is about
 *  what a COACH or STUDENT can reach, and a production-gated fixture is
 *  reachable by neither. */
function isDevFixture(relPath: string): boolean {
  return relPath.startsWith(join("app", "dev") + sep);
}

describe("star-verdict ↔ blind-labeler separation (N1)", () => {
  it("no blind-labeling file imports the star-verdict lane", () => {
    for (const rel of LABELER_FILES) {
      const src = readFileSync(join(SRC, rel), "utf8");
      expect(
        STAR_LANE_IMPORT.test(src),
        `${rel} imports the star-verdict lane — the blind flow must never see the machine's guesses`
      ).toBe(false);
    }
  });

  it("the star-verdict overlay imports nothing from the blind-labeling flow or its label lane", () => {
    const src = readFileSync(join(SRC, OVERLAY), "utf8");
    // The label-lane service (DirectionLabel, saveCoachSnippet) is the blind
    // corpus; the verdict lane must not touch it even for types.
    expect(src).not.toMatch(/from\s+["']@?\/?.*coachReview["']/);
    expect(src).not.toMatch(
      /from\s+["'].*(?:CoachSnippetReviewCard|CoachReviewOverlay|SnippetReadoutBlock|useCoachReview)["']/
    );
  });

  it("only the hub mounts the overlay, and only the overlay calls the service", () => {
    const overlayImporters: string[] = [];
    const serviceImporters: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file);
      if (rel === SERVICE || isDevFixture(rel)) continue;
      const src = readFileSync(file, "utf8");
      if (rel !== OVERLAY && OVERLAY_IMPORT.test(src)) overlayImporters.push(rel);
      if (SERVICE_IMPORT.test(src)) serviceImporters.push(rel);
    }
    // A new name here is a new surface for coach verdicts — decide
    // deliberately (is it still coach-only? still off the blind flow?),
    // do not just add the file.
    expect(overlayImporters.sort()).toEqual(PERMITTED_OVERLAY_IMPORTERS.sort());
    expect(serviceImporters.sort()).toEqual(PERMITTED_SERVICE_IMPORTERS.sort());
  });

  it("no student-lane mapper reads verdict fields (N2 — a verdict is silent toward the student)", () => {
    // The student ideal-text payload mappers must stay verdict-blind: if a
    // verdict ever flows into the student GET's mapping, a coach's judgment
    // becomes visible to the student by inference.
    const idealText = readFileSync(
      join(SRC, "services", "api", "idealText.ts"),
      "utf8"
    );
    for (const marker of ["star_verdict", "wrong_kind", "should_not_fire", "corrected_device"]) {
      expect(
        idealText.includes(marker),
        `idealText.ts mentions "${marker}" — the student lane must stay verdict-blind`
      ).toBe(false);
    }
  });

  it("every dev fixture that reaches the star lane renders nothing in production", () => {
    const fixtures = walk(SRC)
      .map((f) => relative(SRC, f))
      .filter(isDevFixture)
      .filter((rel) => STAR_LANE_IMPORT.test(readFileSync(join(SRC, rel), "utf8")));
    // The exemption above and this gate are the same decision: a fixture is
    // only outside the fence while it cannot be reached.
    expect(fixtures.length).toBeGreaterThan(0);
    for (const rel of fixtures) {
      const src = readFileSync(join(SRC, rel), "utf8");
      expect(
        /process\.env\.NODE_ENV\s*===\s*["']production["'][\s\S]{0,40}return null/.test(src),
        `${rel} imports the star lane but is not gated out of production`
      ).toBe(true);
    }
  });

  it("the paths this fence guards still exist (a rename must update the fence, not evade it)", () => {
    for (const rel of [...LABELER_FILES, OVERLAY, SERVICE]) {
      expect(
        statSync(join(SRC, rel)).isFile(),
        `${rel} is gone — update the separation fence alongside the rename`
      ).toBe(true);
    }
  });

  // sep is imported for platform-correct joins above; keep TS from flagging
  // it unused if the join list ever collapses to literals.
  void sep;
});
