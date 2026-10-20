#!/usr/bin/env node
/**
 * One file with every test's story: docs/TEST-STORIES.csv.
 *
 * Each test file starts with a header block (STORY/OUTCOME/PROVES/WHY, or
 * GUARD/CATCHES/IF REMOVED/PROVES for a developer tripwire). This reads those
 * headers and writes them as one CSV, one row per test file, so the founder
 * can review every story in a spreadsheet instead of across many Markdown
 * files. The test file stays the source; the CSV is generated.
 *
 *   node scripts/stories-csv.mjs           # rewrite docs/TEST-STORIES.csv
 *   node scripts/stories-csv.mjs --check   # exit 1 if the CSV is stale or a test has no header
 *
 * scripts/storiesCsv.test.ts runs the check in CI.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
export const OUT = "docs/TEST-STORIES.csv";
const COLUMNS = ["file", "type", "story", "outcomes", "proves", "why"];
const SECTION = /^\s*(STORY|GUARD|OUTCOME|CATCHES|IF REMOVED|PROVES|WHY)\b\s*(.*)$/;
const TEST_FILE = /\.(test|spec)\.tsx?$/;

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (TEST_FILE.test(entry.name)) out.push(relative(REPO, full).split("\\").join("/"));
  }
  return out;
}

export function storyFiles() {
  return ["src", "scripts"].flatMap((d) => walk(join(REPO, d), [])).sort();
}

/** The header's sections, or null when the file has no STORY/GUARD header. */
export function parseHeader(text) {
  const block = [...text.slice(0, 12000).matchAll(/\/\*([\s\S]*?)\*\//g)]
    .map((m) => m[1].split("\n").map((l) => l.replace(/^\s*\*(?!\/)\s?/, "")).join("\n"))
    .find((b) => /^\s*(STORY|GUARD)\b/m.test(b));
  if (!block) return null;
  const sections = {};
  let current = null;
  for (const line of block.split("\n")) {
    const m = SECTION.exec(line);
    if (m) {
      current = m[1];
      sections[current] = m[2] ? [m[2]] : [];
    } else if (current) sections[current].push(line.trim());
  }
  const joined = (name, sep) => (sections[name] ?? []).filter(Boolean).join(sep).trim();
  if (sections.STORY) {
    return { type: "Story", story: joined("STORY", " "), outcomes: joined("OUTCOME", "\n"),
      proves: joined("PROVES", "\n"), why: joined("WHY", " ") };
  }
  const removed = joined("IF REMOVED", " ");
  return { type: "Guard", story: joined("GUARD", " "), outcomes: joined("CATCHES", "\n"),
    proves: joined("PROVES", "\n"), why: removed ? `If removed: ${removed}` : "" };
}

const cell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function build() {
  const found = [];
  const missing = [];
  for (const file of storyFiles()) {
    const header = parseHeader(readFileSync(join(REPO, file), "utf8"));
    if (header) found.push({ file, ...header });
    else missing.push(file);
  }
  const text = [COLUMNS.join(","), ...found.map((r) => COLUMNS.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
  return { text, found, missing };
}

export function check() {
  const { text, missing } = build();
  const problems = missing.map((m) => `no STORY or GUARD header: ${m}`);
  const outPath = join(REPO, OUT);
  if (!existsSync(outPath) || readFileSync(outPath, "utf8") !== text) {
    problems.push(`${OUT} is out of date: run node scripts/stories-csv.mjs`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const problems = check();
    problems.forEach((p) => console.log(p));
    process.exit(problems.length ? 1 : 0);
  }
  const { text, found, missing } = build();
  writeFileSync(join(REPO, OUT), text);
  console.log(`wrote ${OUT}: ${found.length} test files`);
  missing.forEach((m) => console.log(`no STORY or GUARD header: ${m}`));
  process.exit(missing.length ? 1 : 0);
}
