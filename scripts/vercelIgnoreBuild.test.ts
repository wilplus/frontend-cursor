/*
GUARD    Vercel's Ignored Build Step: the real scripts/vercel-ignore-build.sh,
         run in a throwaway git repo with VERCEL_GIT_PREVIOUS_SHA set as Vercel
         sets it (the last successful deployment's commit).
CATCHES  A change to the app skipped, so a fix never reaches the site; a
         Redeploy (same commit, new environment variables) skipped.
IF REMOVED  A wrong skip looks like a green deploy that changed nothing.
PROVES   skip    -> "skips a merge that changed only docs, Markdown or tests"
         build   -> "builds a code change, even after docs-only merges"
         redeploy -> "builds a Redeploy of the same commit"
         unsure  -> "builds when there is nothing known to compare with"
*/
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = resolve("scripts/vercel-ignore-build.sh");
const SKIP = 0;
const BUILD = 1;

let repo: string;

function git(...args: string[]) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

/** Commit the files given, return the commit's sha. */
function commit(files: Record<string, string>) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), body);
  }
  git("add", "-A");
  git("commit", "-q", "-m", Object.keys(files).join(", "));
  return git("rev-parse", "HEAD");
}

function ignoreStep(previousSha?: string) {
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: repo };
  if (previousSha !== undefined) env.VERCEL_GIT_PREVIOUS_SHA = previousSha;
  return spawnSync("bash", [SCRIPT], { cwd: repo, env, encoding: "utf8" }).status;
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "ignore-build-"));
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  git("config", "commit.gpgsign", "false");
  commit({ "src/app/page.tsx": "v1", "docs/flows/a.md": "v1" });
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("Vercel builds every change the site serves", () => {
  it("skips a merge that changed only docs, Markdown or tests", () => {
    const deployed = git("rev-parse", "HEAD");
    commit({
      "docs/flows/a.md": "v2",
      "CLAUDE.md": "v2",
      "src/app/page.test.tsx": "v2",
      "src/app/api/bffEnvelopes.golden.json": "{}",
    });
    expect(ignoreStep(deployed)).toBe(SKIP);
  });

  it("builds a code change, even after docs-only merges", () => {
    const deployed = git("rev-parse", "HEAD");
    commit({ "src/app/page.tsx": "v2" });
    commit({ "docs/flows/a.md": "v2" });
    expect(ignoreStep(deployed)).toBe(BUILD);
  });

  it("builds a Redeploy of the same commit", () => {
    expect(ignoreStep(git("rev-parse", "HEAD"))).toBe(BUILD);
  });

  it("builds when there is nothing known to compare with", () => {
    commit({ "docs/flows/a.md": "v2" });
    expect(ignoreStep()).toBe(BUILD);
    expect(ignoreStep("")).toBe(BUILD);
    expect(ignoreStep("0123456789abcdef0123456789abcdef01234567")).toBe(BUILD);
  });
});
