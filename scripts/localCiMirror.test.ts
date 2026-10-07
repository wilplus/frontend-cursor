/* -------------------------------------------------------------------------- */
/*  THE LOCAL GATE MIRRORS CI, AND ADDS THE STEP CI IS MISSING                 */
/*                                                                            */
/*  2026-09-19: a commit reached `main` with an `eslint-disable` naming a rule */
/*  this repo does not configure. All five checks CI runs went green, because  */
/*  none of them is `next build` — and `next build` lints the production entry */
/*  graph and fails hard on an unknown rule inside a disable comment. Vercel   */
/*  went red, `main` stopped deploying, and an hour of merged fixes never      */
/*  reached the product.                                                       */
/*                                                                            */
/*  `tsc --noEmit` is not `next build`. So `scripts/local_ci.sh` runs the CI   */
/*  job's steps AND the build, and this test is what stops the two drifting:   */
/*  a step added to the workflow and not to the script would give a local      */
/*  "GREEN" that CI then contradicts, which is how a gate stops being trusted. */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const WORKFLOW = readFileSync(".github/workflows/tests.yml", "utf8");
const SCRIPT = readFileSync("scripts/local_ci.sh", "utf8");

/** The `unit` job's body — everything before the `e2e` job.
 *
 *  The e2e job is deliberately NOT mirrored (Playwright, Chromium and a dev
 *  server, slower than all the rest together, and not what broke), so this
 *  must not read its steps or the test would demand a step the script
 *  documents leaving out. */
const UNIT_JOB = WORKFLOW.slice(
  WORKFLOW.indexOf("  unit:"),
  WORKFLOW.indexOf("  e2e:"),
);
/** The `e2e` job's body. Not mirrored as a whole (see above); one of its steps
 *  is, opt-in: the screenshot harness (X7), checked below. */
const E2E_JOB = WORKFLOW.slice(
  WORKFLOW.indexOf("  e2e:"),
  WORKFLOW.indexOf("  csp:"),
);

/** Single-line `run:` commands, which is every check the unit job performs. */
function commandsOf(job: string): string[] {
  return [...job.matchAll(/^\s+run:\s+(?!\|)(.+)$/gm)]
    .map((m) => m[1].trim())
    .filter((cmd) => !cmd.startsWith("npm ci"))
    // The guard's base fetch is CI plumbing (a clone has origin/main), not a check.
    .filter((cmd) => !cmd.startsWith("git fetch"));
}

describe("the unit job is fully mirrored", () => {
  it("found the job and its steps", () => {
    // A slice that silently came back empty would make every assertion below
    // vacuously true.
    expect(UNIT_JOB).toContain("Complexity ratchet");
    expect(UNIT_JOB).toContain("Design-lock guard");
    expect(UNIT_JOB).not.toContain("playwright");
    expect(commandsOf(UNIT_JOB).length).toBeGreaterThanOrEqual(6);
  });

  it.each(commandsOf(UNIT_JOB))("runs `%s`", (command) => {
    expect(
      SCRIPT,
      `scripts/local_ci.sh does not run "${command}", so a local GREEN would ` +
        "not mean CI is green",
    ).toContain(command);
  });
});

describe("the gate covers what CI does not", () => {
  it("runs the production build", () => {
    // The step whose absence caused the incident. Vercel runs it; CI does not.
    expect(SCRIPT).toContain("npm run build");
    expect(UNIT_JOB).not.toContain("npm run build");
  });

  it("refuses to report GREEN when the build was skipped", () => {
    // --no-build exists for iterating, and must never look like a passing gate.
    expect(SCRIPT).toMatch(/WITH_BUILD" = 0[\s\S]{0,200}INCOMPLETE/);
    expect(SCRIPT).toMatch(/GREEN — every gate CI runs, plus the build/);
  });
});

describe("the design-lock guard (X5) runs everywhere the gate runs", () => {
  it("is a step of the unit job, with the history it needs", () => {
    expect(commandsOf(UNIT_JOB)).toContain("npm run check:design-lock");
    // Reads every commit's trailers against origin/main: no depth-1 checkout.
    expect(UNIT_JOB).toContain("fetch-depth: 0");
    expect(UNIT_JOB).toMatch(/git fetch[^\n]*origin \+?main/);
  });

  it("always runs in the script — never behind an opt-in", () => {
    const guard = SCRIPT.indexOf('step "Design-lock guard" npm run check:design-lock');
    const optIn = SCRIPT.indexOf('if [ "${WILLAB_SCREENSHOTS');
    expect(guard).toBeGreaterThan(0);
    expect(optIn).toBeGreaterThan(guard);
  });
});

describe("the screenshot harness (X7) is the e2e job's, mirrored opt-in", () => {
  it("runs capture.mjs in the e2e job and uploads the pictures", () => {
    expect(E2E_JOB).toContain("node e2e/screenshots/capture.mjs");
    expect(E2E_JOB).toContain("upload-artifact");
    expect(E2E_JOB).toContain("e2e/artifacts/screenshots");
    // The consent screen is a real surface: it reads through the BFF.
    expect(E2E_JOB).toContain("e2e/_fixture-backend.mjs");
  });

  it("runs in the script behind WILLAB_SCREENSHOTS=1, through the same capture.mjs", () => {
    expect(SCRIPT).toMatch(/WILLAB_SCREENSHOTS[^\n]*= 1[\s\S]{0,200}npm run screenshots/);
    const RUNNER = readFileSync("scripts/screenshots.sh", "utf8");
    expect(RUNNER).toContain("node e2e/screenshots/capture.mjs");
    expect(RUNNER).toContain("e2e/_fixture-backend.mjs");
    expect(RUNNER).not.toContain("playwright install");
  });
});
