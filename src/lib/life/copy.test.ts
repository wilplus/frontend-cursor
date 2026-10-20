/*
STORY    As the founder, I want the Life Panel copy to have no scores, streaks or
         percentages, no em-dashes, and no unused copy, so that sign-off covers
         only real, number-free words.
OUTCOME
  O1  No string names a score, streak, percentage or consistency meter, unless
      it says the panel does NOT have one. Never-1: no score reaches a speaker.
  O2  No string carries an em-dash (house rule), except the one quoted founder
      line exempted by name.
  O3  Every export is imported by something outside the tests, so sign-off
      never covers copy nobody sees.
PROVES   O1 -> "surfaces no score, streak, percentage or consistency meter"
         O2 -> "uses no em-dash outside the founder's quoted line"
         O3 -> "every export is imported by a screen or module"
WHY      SETUP_GATE_REDIRECT sat here for four commits, rendered by nothing.
         The Life Panel is off the main loop.
*/
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import * as copy from "./copy";

/** Every string reachable from the module's exports, with a path for the
 *  failure message. */
function strings(
  value: unknown,
  path = ""
): Array<{ path: string; text: string }> {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      strings(v, path ? `${path}.${k}` : k)
    );
  }
  return [];
}

const ALL = strings(copy);

/** "there is no streak, no score" must pass while "your streak" must fail, so a
 *  match is ignored when it sits just after a negation in the same sentence. */
const NEGATED = /\b(no|not|never|without|nothing)\b[^.]{0,24}$/i;

function offends(text: string, pattern: RegExp): boolean {
  const re = new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`);
  for (const match of text.matchAll(re)) {
    if (!NEGATED.test(text.slice(0, match.index))) return true;
  }
  return false;
}

describe("panel copy", () => {

  it("surfaces no score, streak, percentage or consistency meter", () => {
    // The fence must have something to read.
    expect(ALL.length).toBeGreaterThan(50);
    const banned =
      /\b(streaks?|scores?|scored|scoring|consistency|percent(age)?|rating|ranked)\b/i;
    const offenders = ALL.filter((s) => offends(s.text, banned));
    expect(offenders.map((s) => s.path)).toEqual([]);
  });

  it("uses no em-dash outside the founder's quoted line", () => {
    // DAY.distractionQuestion is the founder's verbatim punctuation (2026-07-30).
    const EXEMPT = new Set(["DAY.distractionQuestion"]);
    const offenders = ALL.filter((s) => s.text.includes("—") && !EXEMPT.has(s.path));
    expect(offenders.map((s) => s.path)).toEqual([]);
  });
});

describe("reachability", () => {
  const SRC = join(process.cwd(), "src");
  const LIFE = join(SRC, "lib", "life");

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) return [];
      return [full];
    });
  }

  it("every export is imported by a screen or module", () => {
    const imported = new Set<string>();
    for (const file of sourceFiles(SRC)) {
      const code = readFileSync(file, "utf8");
      // "./copy" is this module only from inside lib/life.
      const sameDir = relative(LIFE, file).startsWith("..") ? "" : "|\\.\\/copy";
      const re = new RegExp(
        `import\\s*\\{([^}]*)\\}\\s*from\\s*["'](?:@\\/lib\\/life\\/copy${sameDir})["']`,
        "g",
      );
      for (const m of code.matchAll(re)) {
        for (const name of m[1].split(",")) {
          const bare = name.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, "");
          if (bare) imported.add(bare);
        }
      }
    }
    const exports = Object.keys(copy);
    expect(exports.length).toBeGreaterThan(0);
    expect(exports.filter((name) => !imported.has(name))).toEqual([]);
  });
});
