import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* -------------------------------------------------------------------------- */
/*  SEPARATION TEST — the N1 fence for the star-verdict surface, in code       */
/*                                                                            */
/*  The star-verdict surface SHOWS the machine's guesses (that is its job:     */
/*  the coach judges whether each star should have fired). The blind labeling  */
/*  flow must never see a machine guess — §S.3 label hygiene. The consolidated */
/*  review overlay therefore has two strict phases: blind labels first, then  */
/*  (and only then) the contextual machine-verdict pass.                       */
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

/** Shared presentational chrome, used by BOTH lanes (founder 2026-07-30:
 *  "unify the plumbing, keep the surfaces separate"). A file both lanes import
 *  is the obvious smuggling route for a machine guess into the blind flow, so
 *  it is fenced from both directions too: chrome may know about pills and
 *  cards, never about directions, star families, devices or verdicts. */
const SHARED_CHROME = join("components", "willab", "coachChrome.tsx");

/** Everything permitted to import the star-verdict lane. The Lounge is the
 *  hub that mounts every overlay as siblings — the ONE file allowed to know
 *  both flows. The detail/roster screens carry the entry callback (a plain
 *  prop, no star imports needed — listed here only for the overlay, which
 *  they never import today; tightening later is fine). */
const PERMITTED_OVERLAY_IMPORTERS = [
  join("components", "willab", "Lounge.tsx"),
];
const PERMITTED_SERVICE_IMPORTERS = [OVERLAY];

/** Any QUOTED module path naming the lane — deliberately shape-agnostic so it
 *  catches `import x from`, `import type`, `import(...)`, `require(...)`,
 *  `export * from`, and any alias/relative depth alike. A `from "..."`-shaped
 *  regex was blind to dynamic import and require (review 2026-07-28); the
 *  fence is only as strong as its dullest matcher. A comment merely NAMING
 *  the lane inside a labeler file will also trip this — that is accepted:
 *  it forces a deliberate decision, which is the fence's whole job. */
const STAR_LANE_IMPORT =
  /["'][^"'\n]*(?:starVerdicts|CoachStarVerdictOverlay)["']/;

const OVERLAY_IMPORT = /["'][^"'\n]*CoachStarVerdictOverlay["']/;
const SERVICE_IMPORT = /["'][^"'\n]*(?:\/|^)starVerdicts["']/;

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
        `${rel} imports the star-verdict lane — the blind flow must never see the machine's guesses`,
      ).toBe(false);
    }
  });

  it("the star-verdict overlay imports nothing from the blind-labeling flow or its label lane", () => {
    const src = readFileSync(join(SRC, OVERLAY), "utf8");
    // The label-lane service (DirectionLabel, saveCoachSnippet) is the blind
    // corpus; the verdict lane must not touch it even for types.
    expect(src).not.toMatch(/from\s+["']@?\/?.*coachReview["']/);
    expect(src).not.toMatch(
      /from\s+["'].*(?:CoachSnippetReviewCard|CoachReviewOverlay|SnippetReadoutBlock|useCoachReview)["']/,
    );
  });

  it("does not fetch or render contextual star review until the blind pass is complete", () => {
    const src = readFileSync(join(SRC, OVERLAY), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    const fetchIndex = src.indexOf("void fetchCoachArcStars");
    const fetchEffect = src.slice(
      src.lastIndexOf("useEffect", fetchIndex),
      src.indexOf("const handlePublish"),
    );
    expect(fetchEffect).toContain("blindComplete");
    const blindReturn = src.indexOf("if (!blindComplete)");
    const contextualReturn = src.lastIndexOf("return (");
    expect(blindReturn).toBeGreaterThan(-1);
    expect(contextualReturn).toBeGreaterThan(blindReturn);
    const blindTree = src.slice(blindReturn, contextualReturn);
    expect(blindTree).toContain("ConfidenceLabelChips");
    expect(blindTree).not.toContain("starChipLabel");
    expect(blindTree).not.toContain("Publish the full analysis");
  });

  it("the shared coach chrome bridges neither lane", () => {
    const src = readFileSync(join(SRC, SHARED_CHROME), "utf8");
    // Direction 1 — chrome must not reach into the star lane.
    expect(
      STAR_LANE_IMPORT.test(src),
      "coachChrome imports the star-verdict lane — shared chrome must not bridge the lanes",
    ).toBe(false);
    // Direction 2 — nor into the blind flow or its label service.
    expect(src).not.toMatch(/from\s+["']@?\/?.*coachReview["']/);
    expect(src).not.toMatch(
      /from\s+["'].*(?:CoachSnippetReviewCard|CoachReviewOverlay|SnippetReadoutBlock|useCoachReview)["']/,
    );
  });

  it("the shared chrome carries no lane vocabulary — only chrome", () => {
    // The fence is about anchoring: a coach labeling direction blind must not
    // meet the machine's vocabulary on the way. Chrome that starts naming
    // verdicts or star families has become a lane, whatever the filename says.
    const src = readFileSync(join(SRC, SHARED_CHROME), "utf8");
    // Prose in the header comment explains WHY the fence exists and must stay
    // readable, so only code is searched.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    for (const banned of [
      "threat",
      "ambiguous",
      "challenge",
      "keep",
      "wrong_kind",
      "should_not_fire",
      "emphasize",
      "structure",
      "delivery",
    ]) {
      expect(
        new RegExp(`\\b${banned}\\b`, "i").test(code),
        `coachChrome names "${banned}" — that vocabulary belongs to a lane, not to shared chrome`,
      ).toBe(false);
    }
  });

  it("only the hub mounts the overlay, and only the overlay calls the service", () => {
    const overlayImporters: string[] = [];
    const serviceImporters: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file);
      if (rel === SERVICE || isDevFixture(rel)) continue;
      const src = readFileSync(file, "utf8");
      if (rel !== OVERLAY && OVERLAY_IMPORT.test(src))
        overlayImporters.push(rel);
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
      "utf8",
    );
    for (const marker of [
      "star_verdict",
      "wrong_kind",
      "should_not_fire",
      "corrected_device",
    ]) {
      expect(
        idealText.includes(marker),
        `idealText.ts mentions "${marker}" — the student lane must stay verdict-blind`,
      ).toBe(false);
    }
  });

  it("every dev fixture that reaches the star lane renders nothing in production", () => {
    const fixtures = walk(SRC)
      .map((f) => relative(SRC, f))
      .filter(isDevFixture)
      .filter((rel) =>
        STAR_LANE_IMPORT.test(readFileSync(join(SRC, rel), "utf8")),
      );
    // The exemption above and this gate are the same decision: a fixture is
    // only outside the fence while it cannot be reached.
    expect(fixtures.length).toBeGreaterThan(0);
    for (const rel of fixtures) {
      const src = readFileSync(join(SRC, rel), "utf8");
      expect(
        /process\.env\.NODE_ENV\s*===\s*["']production["'][\s\S]{0,40}return null/.test(
          src,
        ),
        `${rel} imports the star lane but is not gated out of production`,
      ).toBe(true);
    }
  });

  it("the paths this fence guards still exist (a rename must update the fence, not evade it)", () => {
    for (const rel of [...LABELER_FILES, OVERLAY, SERVICE, SHARED_CHROME]) {
      expect(
        statSync(join(SRC, rel)).isFile(),
        `${rel} is gone — update the separation fence alongside the rename`,
      ).toBe(true);
    }
  });

  // sep is imported for platform-correct joins above; keep TS from flagging
  // it unused if the join list ever collapses to literals.
  void sep;
});
