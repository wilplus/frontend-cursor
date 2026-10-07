#!/usr/bin/env node
/* -------------------------------------------------------------------------- */
/*  THE DESIGN-LOCK GUARD (build plan X5).                                     */
/*                                                                            */
/*  CLAUDE.md locks the speaker's Ideal Text screens, the Feedback walk, the   */
/*  coach panel, the recording screens and the consent screens to the          */
/*  founder's prototypes: another session does not change their layout, flow  */
/*  or wording without the founder. This is the check that makes the rule a   */
/*  gate instead of a sentence.                                                */
/*                                                                            */
/*  It lists the commits on this branch that are not on the base              */
/*  (origin/main, or DESIGN_LOCK_BASE / --base), and for each commit that      */
/*  touches a file in scripts/design-locked-files.txt it reads the commit's    */
/*  trailers. A commit without a non-empty `Founder-Approved:` trailer fails   */
/*  the run and is named with its files. Uncommitted changes to a locked file  */
/*  are reported, not failed: CI only ever sees commits, so the trailer goes   */
/*  on the commit.                                                             */
/*                                                                            */
/*    npm run check:design-lock                  # in CI and scripts/local_ci.sh */
/*    node scripts/check-design-lock.mjs --base origin/main --list <file>      */
/*                                                                            */
/*  How a session adds the trailer: the founder's decision, as the last lines  */
/*  of the commit message, with the other trailers —                           */
/*                                                                            */
/*      Founder-Approved: Navigation Panel GO-W1, 2026-10-07                   */
/*                                                                            */
/*  (git keeps it in the trailer block; `git log --format=%(trailers)` shows   */
/*  it). The value is free text naming where the founder said yes.            */
/* -------------------------------------------------------------------------- */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export const TRAILER = "Founder-Approved";
export const LIST_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "design-locked-files.txt");
export const DEFAULT_BASE = "origin/main";

/** The list file: one path per line, `#` comments, a trailing `/` locks a tree. */
export function parseList(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean);
}

/** A test is never a locked screen. */
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

export function isLocked(path, patterns) {
  if (TEST_FILE.test(path)) return false;
  return patterns.some((p) => (p.endsWith("/") ? path.startsWith(p) : path === p));
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** The trailer's value on a commit, "" when absent or empty. */
export function trailerOf(cwd, sha) {
  return git(cwd, ["log", "-1", `--format=%(trailers:key=${TRAILER},valueonly,unfold)`, sha]).trim();
}

/**
 * Run the guard. Returns { code, lines }: code 0 clean, 1 a locked diff without
 * the trailer, 2 the base could not be resolved.
 */
export function run({ cwd = process.cwd(), base = DEFAULT_BASE, list = LIST_PATH } = {}) {
  const lines = [];
  const patterns = parseList(readFileSync(list, "utf8"));

  let mergeBase;
  try {
    git(cwd, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
    mergeBase = git(cwd, ["merge-base", base, "HEAD"]);
  } catch {
    lines.push(`design-lock guard: cannot resolve the base "${base}". Fetch it (git fetch origin main) or set DESIGN_LOCK_BASE.`);
    return { code: 2, lines };
  }

  const commits = git(cwd, ["rev-list", "--no-merges", "--reverse", `${mergeBase}..HEAD`])
    .split("\n")
    .filter(Boolean);

  const offences = [];
  let checked = 0;
  for (const sha of commits) {
    const files = git(cwd, ["diff-tree", "--no-commit-id", "--name-only", "-r", "--root", sha])
      .split("\n")
      .filter(Boolean);
    const locked = files.filter((f) => isLocked(f, patterns));
    if (locked.length === 0) continue;
    checked += 1;
    const value = trailerOf(cwd, sha);
    const subject = git(cwd, ["log", "-1", "--format=%s", sha]);
    if (value) {
      lines.push(`  ok    ${sha.slice(0, 10)} ${subject}  (${TRAILER}: ${value})`);
    } else {
      offences.push({ sha, subject, locked });
    }
  }

  for (const { sha, subject, locked } of offences) {
    lines.push(`  FAIL  ${sha.slice(0, 10)} ${subject}`);
    lines.push(`        changes a design-locked file without a "${TRAILER}:" trailer:`);
    for (const f of locked) lines.push(`          ${f}`);
  }

  const dirty = git(cwd, ["status", "--porcelain", "--untracked-files=all"])
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3).replace(/^.* -> /, ""))
    .filter((f) => isLocked(f, patterns));
  if (dirty.length) {
    lines.push(`  note  uncommitted changes to design-locked files (the commit will need "${TRAILER}:"):`);
    for (const f of dirty) lines.push(`          ${f}`);
  }

  if (offences.length) {
    lines.push("");
    lines.push(`design-lock guard: ${offences.length} commit(s) change a locked screen without the founder's approval.`);
    lines.push(`Add the trailer to the commit message, as its last lines, e.g.`);
    lines.push(`    ${TRAILER}: Navigation Panel GO-W1, 2026-10-07`);
    lines.push(`(git commit --amend, or git rebase -i on your own branch) — or leave the locked file as it is.`);
    return { code: 1, lines };
  }
  lines.push(`design-lock guard: clean — ${commits.length} commit(s) since ${base}, ${checked} touching locked files, all approved.`);
  return { code: 0, lines };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const { code, lines } = run({
    base: opt("--base", process.env.DESIGN_LOCK_BASE || DEFAULT_BASE),
    list: opt("--list", LIST_PATH),
    cwd: opt("--cwd", process.cwd()),
  });
  console.log(lines.join("\n"));
  process.exit(code);
}
