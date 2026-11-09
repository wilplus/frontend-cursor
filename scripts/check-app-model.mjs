#!/usr/bin/env node
/* -------------------------------------------------------------------------- */
/*  THE APP MODEL CHECK, the frontend half (founder, 9 November 2026;          */
/*  backend N574 item 4).                                                      */
/*                                                                            */
/*  The App Model joins every locked prototype into one clickable phone, with  */
/*  the user stories beside it: each a Given, a When and a Then, the rule it   */
/*  comes from, the code that does it and the test that proves it. A developer */
/*  compares the code with it, so its stories help only while they point at    */
/*  code and tests that exist. The stories live in the backend               */
/*  (docs/design/app-model-<date>/stories.json, the newest folder its          */
/*  docs/LOCKS.md links); the backend checks its own refs and tests           */
/*  (scripts/app_model_stories.py), and this checks this repo's:              */
/*                                                                            */
/*  1. A story's "fe:<path>::<literal>" ref: the file is here and the literal  */
/*     is on one of its lines (no literal: the file is enough).               */
/*  2. A story's frontend test (any test that is not .py or .jsonl): the file  */
/*     is here and docs/TEST-STORIES.csv lists it.                            */
/*                                                                            */
/*  It fails the change that breaks one: a ref or a test that holds on the     */
/*  base (origin/main) and not here. Change the story in the backend first,   */
/*  or keep the code ("one in, one out" moves a test's promise into the new   */
/*  test). A ref that main misses already is listed, not failed, so the order */
/*  of a cross-repo rename never turns unrelated pull requests red; fix it in */
/*  the backend's stories.json.                                               */
/*                                                                            */
/*    npm run check:app-model                 # in CI and scripts/local_ci.sh */
/*    node scripts/check-app-model.mjs --stories ../backend-cursor/docs/design/app-model-2026-11-09/stories.json */
/* -------------------------------------------------------------------------- */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = "https://raw.githubusercontent.com/wilplus/backend-cursor/main/";
export const LOCKS_URL = `${RAW}docs/LOCKS.md`;
export const TESTS_CSV = "docs/TEST-STORIES.csv";
const MODEL = /design\/(app-model-\d{4}-\d{2}-\d{2})\//g;
const BACKEND_TEST = /\.(py|jsonl)$/;

/** ["fe", path, literal] for "fe:<path>::<literal>"; null for a backend ref or a malformed one. */
export function parseRef(ref) {
  const text = String(ref);
  if (!text.startsWith("fe:")) return null;
  const [path, ...rest] = text.slice(3).split("::");
  if (!path || path.startsWith("/") || path.split("/").includes("..")) return null;
  return [path, rest.join("::")];
}

/** The newest app-model folder a LOCKS.md links, or null. */
export function modelFolder(locks) {
  const folders = [...String(locks).matchAll(MODEL)].map((m) => m[1]).sort();
  return folders.length ? folders[folders.length - 1] : null;
}

/** The test files a TEST-STORIES.csv lists (its first column). */
export function listedTests(csv) {
  if (!csv) return new Set();
  return new Set(
    csv
      .split("\n")
      .slice(1)
      .map((line) => (line.startsWith('"') ? line.slice(1, line.indexOf('"', 1)) : line.split(",")[0]).trim())
      .filter(Boolean),
  );
}

const holdsRef = (text, literal) => text != null && (!literal || text.split("\n").some((line) => line.includes(literal)));
const holdsTest = (text, listed, path) => text != null && listed.has(path);

/**
 * Check the stories against this tree and the base.
 *   head(path), base(path): the file's text there, or null when it has no such file.
 *   base is called only for what fails here; it throws when the base can't be read.
 * Returns { broken, stale, refs, tests }: broken fails the change, stale only lists.
 */
export function check(stories, { head, base }) {
  const headListed = listedTests(head(TESTS_CSV));
  let baseListed = null;
  const broken = [];
  const stale = [];
  let refs = 0;
  let tests = 0;
  for (const story of stories) {
    const id = story.id || "a story with no id";
    for (const ref of story.code || []) {
      if (!String(ref).startsWith("fe:")) continue;
      refs += 1;
      const parsed = parseRef(ref);
      if (parsed && holdsRef(head(parsed[0]), parsed[1])) continue;
      if (parsed && holdsRef(base(parsed[0]), parsed[1])) broken.push(`${id} names ${ref}, which this change removes.`);
      else stale.push(`${id} names ${ref}, which main does not have either.`);
    }
    for (const test of story.tests || []) {
      if (BACKEND_TEST.test(String(test))) continue;
      tests += 1;
      if (holdsTest(head(test), headListed, test)) continue;
      baseListed ??= listedTests(base(TESTS_CSV));
      if (holdsTest(base(test), baseListed, test))
        broken.push(`${id} names the test ${test}, which this change deletes or takes out of ${TESTS_CSV}.`);
      else stale.push(`${id} names the test ${test}, which main does not have either.`);
    }
  }
  return { broken, stale, refs, tests };
}

function readHere(cwd) {
  return (path) => {
    const file = join(cwd, path);
    return existsSync(file) ? readFileSync(file, "utf8") : null;
  };
}

function readBase(cwd, rev) {
  const cache = new Map();
  let resolved = false;
  return (path) => {
    if (!resolved) {
      execFileSync("git", ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], { cwd, stdio: "ignore" });
      resolved = true;
    }
    if (!cache.has(path)) {
      try {
        cache.set(path, execFileSync("git", ["show", `${rev}:${path}`], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 }));
      } catch {
        cache.set(path, null);
      }
    }
    return cache.get(path);
  };
}

/** Run the check. Returns { code, lines }: 0 clean, 1 a change breaks a story, 2 the base could not be read. */
export function run(stories, { folder = "the App Model", cwd = ROOT, base = "origin/main" } = {}) {
  if (!Array.isArray(stories)) return { code: 1, lines: [`App Model stories: RED, the stories of ${folder} are not a list.`] };
  let result;
  try {
    result = check(stories, { head: readHere(cwd), base: readBase(cwd, base) });
  } catch {
    return {
      code: 2,
      lines: [`App Model stories: CANNOT CHECK. Something a story names is missing here, and the base "${base}" can't be read to tell whether this change removed it. Fetch it (git fetch origin main).`],
    };
  }
  const { broken, stale, refs, tests } = result;
  const lines = stale.length
    ? [`Already missing on main (not this change's; fix the story in the backend's docs/design/${folder}/stories.json, backend N574):`, ...stale.map((s) => `  ${s}`)]
    : [];
  if (broken.length) {
    return {
      code: 1,
      lines: [
        ...lines,
        `App Model stories: RED, ${broken.length} story ref(s) this change breaks:`,
        ...broken.map((s) => `  ${s}`),
        `Keep the code, or change the story in the backend's docs/design/${folder}/stories.json first (backend N574). ` +
          `A replaced test moves its promise into the new test, which the story then names ("one in, one out"). ` +
          "A story merged minutes ago can take a few minutes to show.",
      ],
    };
  }
  const note = stale.length ? `; ${stale.length} already missing on main, listed above` : "";
  return { code: 0, lines: [...lines, `App Model stories: clean. ${refs} frontend refs and ${tests} frontend tests named by ${folder}'s stories hold here${note}.`] };
}

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

/** The stories and their folder: a local file (--stories), APP_MODEL_STORIES_URL, or the backend's main. */
async function loadStories(args) {
  const i = args.indexOf("--stories");
  if (i >= 0) {
    const path = resolve(args[i + 1]);
    return { stories: JSON.parse(readFileSync(path, "utf8")), folder: (path.match(/app-model-[^/\\]+/) || ["the App Model"])[0] };
  }
  if (process.env.APP_MODEL_STORIES_URL) return { stories: JSON.parse(await fetchText(process.env.APP_MODEL_STORIES_URL)), folder: "the App Model" };
  const folder = modelFolder(await fetchText(LOCKS_URL));
  if (!folder) throw new Error("the backend's docs/LOCKS.md links no docs/design/app-model-<date>/ folder");
  return { stories: JSON.parse(await fetchText(`${RAW}docs/design/${folder}/stories.json`)), folder };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const b = args.indexOf("--base");
  let loaded;
  try {
    loaded = await loadStories(args);
  } catch (err) {
    console.log(`App Model stories: not checked, the backend's stories could not be read (${err.message}).`);
    process.exit(0);
  }
  const { code, lines } = run(loaded.stories, { folder: loaded.folder, base: b >= 0 ? args[b + 1] : process.env.APP_MODEL_BASE || "origin/main" });
  console.log(lines.join("\n"));
  process.exit(code);
}
