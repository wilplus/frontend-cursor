#!/usr/bin/env node
/* -------------------------------------------------------------------------- */
/*  THE DOCS GUARD (founder, 2026-10-21; backend N107 and N111).               */
/*                                                                            */
/*  By 21 October 2026 the two repos held 423 Markdown files, because every    */
/*  piece of work started a file of its own. N107 cut them down and said a     */
/*  new doc is not started. This is the check that keeps that true. Three      */
/*  checks, against this repo's README.md:                                     */
/*                                                                            */
/*  1. Every part of the code has a home doc. The table under "Home docs for   */
/*     the code" names code by folder or file pattern and its home doc ("No    */
/*     page" when the code and its comments describe it). Every tracked file   */
/*     outside the docs, the tests and the dot-folders must match a row, or    */
/*     be a file a flow page guards (scripts/flow-pages.txt), whose home is    */
/*     that page. A pattern that matches nothing is refused, so the table      */
/*     can't go stale, and so is a home doc that is missing, History or        */
/*     Archive.                                                                */
/*  2. Every doc is listed: README.md links every .md file outside the         */
/*     dot-folders (.claude/, .cursor/, .taskmaster/ are tooling).             */
/*  3. A new doc needs the founder: a .md file the base (origin/main) does     */
/*     not have must be linked from a README.md line that carries              */
/*     `Founder-Approved: <where and when the founder said yes>`.              */
/*                                                                            */
/*  4. Every N-number a rules page cites (CLAUDE.md, README.md, a doc         */
/*     labelled In force) is an entry in the backend's decisions log, which   */
/*     the check reads from GitHub; nothing is in force until it is written   */
/*     there (backend N95; docs audit, 2026-10-26). N78 and N91 were cited    */
/*     but never written; the log's header says so.                           */
/*                                                                            */
/*  Patterns: "dir/" covers the folder, "*" matches within one path segment,   */
/*  anything else is one exact file. The most exact pattern wins (an exact     */
/*  path, then the longest pattern without its "*"); two equally exact         */
/*  patterns with different homes are refused.                                 */
/*                                                                            */
/*    npm run check:docs                     # in CI and scripts/local_ci.sh  */
/*    node scripts/check-docs.mjs --base origin/main                          */
/* -------------------------------------------------------------------------- */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FLOW_PAGES_PATH, isLocked, parseFlowPages } from "./check-design-lock.mjs";

export const MASTER = "README.md";
export const START = "<!-- code-homes:start -->";
export const END = "<!-- code-homes:end -->";
export const APPROVED = "Founder-Approved:";
const NO_PAGE = "No page";
const OTHER_REPO = "https://github.com/wilplus/backend-cursor/blob/main/";
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
const LINK = /\]\(([^)\s]+)\)/g;
const UNEDITED = /\*\*Label: (History|Archive)\*\*/;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const LOG_URL = "https://raw.githubusercontent.com/wilplus/backend-cursor/main/docs/SPEC-DECISIONS-LOG.md";
const ENTRY = /^\*\*N(\d+) ·/gm;
const CITE = /(?<![A-Za-z0-9_\-./#])N(\d{1,3})(?!\d)/g;
const IN_FORCE = "**Label: In force**";
/** Cited but never written as entries; the backend log's header lists them. */
const KNOWN_UNLOGGED = new Set([78, 91]);

/** The rows of the home-doc table: [{ part, patterns, home }], home null for "No page". */
export function parseHomes(readme) {
  if (!readme.includes(START) || !readme.includes(END)) return [];
  const table = readme.split(START)[1].split(END)[0];
  const rows = [];
  for (const line of table.split("\n")) {
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells.length !== 3 || /^[-: ]*$/.test(cells[0]) || cells[1] === "Files") continue;
    const patterns = [...cells[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const link = cells[2].match(/\]\(([^)\s]+)\)/);
    const home = cells[2].includes(NO_PAGE) ? null : link ? link[1] : cells[2];
    rows.push({ part: cells[0], patterns, home });
  }
  return rows;
}

export function matches(pattern, path) {
  if (pattern.endsWith("/")) return path.startsWith(pattern);
  const rx = pattern.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*");
  return new RegExp(`^${rx}$`).test(path);
}

function exactness(pattern) {
  const exact = !pattern.includes("*") && !pattern.endsWith("/");
  return (exact ? 10_000 : 0) + pattern.replaceAll("*", "").length;
}

export function isCode(path) {
  return !path.endsWith(".md") && !path.startsWith("docs/") && !path.startsWith(".") && !TEST_FILE.test(path);
}

/** The winning rows for a file and their patterns. */
export function homeOf(path, rows) {
  const hits = rows.flatMap((row) => row.patterns.filter((p) => matches(p, path)).map((p) => ({ row, p, score: exactness(p) })));
  if (!hits.length) return [];
  const best = Math.max(...hits.map((h) => h.score));
  return hits.filter((h) => h.score === best);
}

export function checkHomes(files, rows, flows, root) {
  if (!rows.length) return [`${MASTER} has no home-doc table between ${START} and ${END}.`];
  const problems = [];
  const flowFiles = (f) => flows.some((flow) => isLocked(f, flow.files));
  for (const f of files.filter(isCode)) {
    if (flowFiles(f)) continue;
    const winners = homeOf(f, rows);
    if (!winners.length) problems.push(`${f} has no home doc. Add it to a row of the table in ${MASTER}, or add a row.`);
    else if (new Set(winners.map((w) => w.row.home)).size > 1)
      problems.push(`${f} is claimed equally by ${winners.map((w) => w.p).join(", ")}, with different home docs.`);
  }
  for (const row of rows) {
    for (const p of row.patterns) {
      if (!files.some((f) => matches(p, f)))
        problems.push(`the pattern ${p} (${row.part}) matches no file. Remove it, or fix it after a rename.`);
    }
    if (row.home === null || row.home.startsWith(OTHER_REPO)) continue;
    const doc = join(root, row.home.split("#")[0]);
    if (!existsSync(doc)) problems.push(`the home doc ${row.home} (${row.part}) does not exist.`);
    else if (UNEDITED.test(readFileSync(doc, "utf8").slice(0, 2000)))
      problems.push(`the home doc ${row.home} (${row.part}) is History or Archive, which is not edited. Pick a doc that is.`);
  }
  return problems;
}

export function linksIn(text) {
  return new Set([...text.matchAll(LINK)].map((m) => m[1].split("#")[0]));
}

const isDoc = (f) => f.endsWith(".md") && !f.startsWith(".");

export function checkListed(files, readme) {
  const listed = linksIn(readme);
  return files
    .filter((f) => isDoc(f) && f !== MASTER && !listed.has(f))
    .map((f) => `${f} is not listed in ${MASTER}. Every doc has a line there (backend N106).`);
}

export function checkNew(added, readme) {
  const approved = new RegExp(`${APPROVED}\\s*\\S`);
  return added
    .filter(isDoc)
    .filter((f) => !readme.split("\n").some((line) => linksIn(line).has(f) && approved.test(line)))
    .map(
      (f) =>
        `${f} is a new doc. Backend N107: a new doc needs the founder's OK. Its line in ${MASTER} must say ` +
        `"${APPROVED} <where and when the founder said yes>", or edit the code's home doc instead.`,
    );
}

/** Rules pages whose N-numbers cite the backend log, from N95's order. */
export function checkCitations(pages, log) {
  const have = new Set([...log.matchAll(ENTRY)].map((m) => Number(m[1])));
  const problems = [];
  for (const [path, text] of Object.entries(pages)) {
    const cited = new Set([...text.matchAll(CITE)].map((m) => Number(m[1])));
    const missing = [...cited].filter((k) => !have.has(k) && !KNOWN_UNLOGGED.has(k)).sort((a, b) => a - b);
    if (missing.length)
      problems.push(
        `${path} cites ${missing.map((k) => `N${k}`).join(", ")}, which the backend's decisions log doesn't have. ` +
          "Log the decision there first (backend N95), or fix the number. An entry merged minutes ago can take a few minutes to show.",
      );
  }
  return problems;
}

function rulesPages(files, cwd) {
  const pages = {};
  for (const f of files.filter((f) => f.endsWith(".md") && !f.startsWith("."))) {
    const text = readFileSync(join(cwd, f), "utf8");
    if (f === "CLAUDE.md" || f === MASTER || text.slice(0, 2000).includes(IN_FORCE)) pages[f] = text;
  }
  return pages;
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Run the guard. Returns { code, lines }: 0 clean, 1 problems, 2 the base could not be resolved. */
export function run({ cwd = ROOT, base = "origin/main", flows = FLOW_PAGES_PATH, log } = {}) {
  const files = git(cwd, ["ls-files"]).split("\n").filter(Boolean);
  const readme = readFileSync(join(cwd, MASTER), "utf8");
  const rows = parseHomes(readme);
  const problems = [
    ...checkHomes(files, rows, parseFlowPages(readFileSync(flows, "utf8")), cwd),
    ...checkListed(files, readme),
    ...(typeof log === "string" ? checkCitations(rulesPages(files, cwd), log) : []),
  ];
  let code = 0;
  try {
    git(cwd, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
    const added = git(cwd, ["diff", "--name-only", "-M", "--diff-filter=A", base, "HEAD"]).split("\n").filter(Boolean);
    problems.push(...checkNew(added, readme));
  } catch {
    problems.push(`cannot see the base "${base}", so new docs were not checked. Fetch it (git fetch origin main).`);
    code = 2;
  }
  if (problems.length) {
    return {
      code: code || 1,
      lines: [
        `docs guard: ${code === 2 ? "CANNOT CHECK" : "RED"}, ${problems.length} problem(s):`,
        ...problems.map((p) => `  ${p}`),
        `Where code is written up: ${MASTER}, "Home docs for the code". Docs are not started (backend N107).`,
      ],
    };
  }
  const count = files.filter(isCode).length;
  const cites = typeof log === "string" ? "every N cited is in the backend log" : "citations not checked (the backend log could not be read)";
  return { code: 0, lines: [`docs guard: clean. ${count} code files with a home doc in ${rows.length} rows or a flow page; every doc listed; no unapproved new doc; ${cites}.`] };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--base");
  let log = null;
  try {
    const res = await fetch(process.env.DOCS_GUARD_LOG_URL || LOG_URL, { signal: AbortSignal.timeout(15000) });
    if (res.ok) log = await res.text();
  } catch {
    log = null;
  }
  const { code, lines } = run({ base: i >= 0 ? args[i + 1] : process.env.DOCS_GUARD_BASE || "origin/main", log });
  console.log(lines.join("\n"));
  process.exit(code);
}
