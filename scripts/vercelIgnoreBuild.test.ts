/*
GUARD    Vercel's ignore step (scripts/vercel-ignore-build.sh, vercel.json
         `ignoreCommand`), run for real against a throwaway git history.
CATCHES  A merge that changed the app skipped, so main stops reaching the
         product; a docs- or test-only merge stored as a full deployment
         again; a redeploy (an env var changed) skipped.
IF REMOVED  A pattern widened by mistake could stop every app change from
         deploying while CI stays green.
PROVES   skip     -> "skips a merge that changed only docs, tests and CI guards"
         build    -> "builds a merge that changed what the app is built from"
         redeploy -> "builds a redeploy of the deployed commit"
WHY      2026-10-21: 476 production deployments in 30 days, each stored for
         the retention period; 31 of them changed nothing the app is built from.
*/
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SCRIPT = resolve("scripts/vercel-ignore-build.sh");
let repo: string;
const sha: Record<string, string> = {};

function git(...args: string[]): string {
  const run = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    cwd: repo,
    encoding: "utf8",
  });
  return run.stdout.trim();
}

function commit(name: string, files: string[]) {
  for (const file of files) {
    mkdirSync(join(repo, dirname(file)), { recursive: true });
    writeFileSync(join(repo, file), `${name}\n`);
  }
  git("add", "-A");
  git("commit", "-q", "-m", name);
  sha[name] = git("rev-parse", "HEAD");
}

/** Exit 0 skips the deployment, 1 builds it (Vercel's contract). */
function ignoreStep(previous: string, head: string) {
  git("checkout", "-q", head);
  return spawnSync("bash", [SCRIPT], {
    cwd: repo,
    encoding: "utf8",
    env: { PATH: process.env.PATH, VERCEL_GIT_PREVIOUS_SHA: previous },
  }).status;
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "vercel-ignore-"));
  git("init", "-q");
  commit("deployed", ["src/app/page.tsx"]);
  commit("docs and tests", [
    "docs/flows/feedback-walk-and-chat.md",
    "CLAUDE.md",
    "src/app/page.test.tsx",
    "scripts/check-design-lock.mjs",
    ".github/workflows/tests.yml",
  ]);
  commit("app", ["docs/LOCKS.md", "src/app/page.tsx"]);
  commit("pdf worker", ["scripts/copy-pdf-worker.mjs"]);
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("the ignore step deploys every app change and nothing else", () => {
  it("skips a merge that changed only docs, tests and CI guards", () => {
    expect(ignoreStep(sha.deployed, sha["docs and tests"])).toBe(0);
  });

  it("builds a merge that changed what the app is built from", () => {
    // Measured from the last deployment, not the parent: a skipped merge in
    // between does not hide the app change.
    expect(ignoreStep(sha.deployed, sha.app)).toBe(1);
    // Runs on install and writes into public/, so it is built from.
    expect(ignoreStep(sha.app, sha["pdf worker"])).toBe(1);
  });

  it("builds a redeploy of the deployed commit", () => {
    expect(ignoreStep(sha.deployed, sha.deployed)).toBe(1);
  });
});
