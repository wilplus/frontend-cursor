/*
GUARD    scripts/local_ci.sh runs every command the CI unit job runs, plus
         `npm run build`, on the Node version CI and .nvmrc name.
CATCHES  A step added to .github/workflows/tests.yml but not to the script;
         the build dropped from the script; the Node floor drifting from CI;
         the design-lock guard losing its step or its git history.
IF REMOVED  A local GREEN could stop meaning CI (and Vercel) will be green.
         Reads source text (workflow and script) on purpose: this is plumbing.
PROVES   found the job -> "found the job and its steps"
         mirrored      -> "runs `%s`" (one per unit-job command)
         build         -> "runs the production build"
         node          -> "stops below the job's node-version, which .nvmrc names too"
         design lock   -> "is a step of the unit job, with the history it needs"
WHY      2026-09-19: CI was green, `next build` failed on Vercel, main stopped
         deploying. The --no-build verdict is run for real in localCiVerdict.test.ts.
*/
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const WORKFLOW = readFileSync(".github/workflows/tests.yml", "utf8");
const SCRIPT = readFileSync("scripts/local_ci.sh", "utf8");

/** The `unit` job's body: the workflow's only job since the browser jobs
 *  were removed (founder, 2026-10-12). */
const UNIT_JOB = WORKFLOW.slice(WORKFLOW.indexOf("  unit:"));

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
});

describe("the gate runs on the Node the unit job runs", () => {
  it("stops below the job's node-version, which .nvmrc names too", () => {
    // Under Node 20 every jsdom suite dies at worker start and Vitest is red
    // while every test passes: a gate on an older Node than CI's reports a
    // failure CI never sees. The script stops instead (scripts/localCiVerdict.test.ts
    // runs it), and this keeps its floor, the job and .nvmrc one number.
    const ci = UNIT_JOB.match(/node-version:\s*"?(\d+)/)?.[1];
    expect(ci).toBeDefined();
    expect(SCRIPT).toMatch(new RegExp(`^NODE_MAJOR=${ci}$`, "m"));
    expect(readFileSync(".nvmrc", "utf8").trim()).toBe(ci);
  });
});

describe("the design-lock guard (X5) runs everywhere the gate runs", () => {
  it("is a step of the unit job, with the history it needs", () => {
    expect(commandsOf(UNIT_JOB)).toContain("npm run check:design-lock");
    // Reads every commit's trailers against origin/main: no depth-1 checkout.
    expect(UNIT_JOB).toContain("fetch-depth: 0");
    expect(UNIT_JOB).toMatch(/git fetch[^\n]*origin \+?main/);
  });

});

