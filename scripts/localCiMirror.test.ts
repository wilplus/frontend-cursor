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

/** Single-line `run:` commands, which is every check the unit job performs. */
function commandsOf(job: string): string[] {
  return [...job.matchAll(/^\s+run:\s+(?!\|)(.+)$/gm)]
    .map((m) => m[1].trim())
    .filter((cmd) => !cmd.startsWith("npm ci"));
}

describe("the unit job is fully mirrored", () => {
  it("found the job and its steps", () => {
    // A slice that silently came back empty would make every assertion below
    // vacuously true.
    expect(UNIT_JOB).toContain("Complexity ratchet");
    expect(UNIT_JOB).not.toContain("playwright");
    expect(commandsOf(UNIT_JOB).length).toBeGreaterThanOrEqual(5);
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
