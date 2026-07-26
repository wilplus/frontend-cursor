import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as copy from "./copy";

/* -------------------------------------------------------------------------- */
/*  The copy fence, as a test                                                  */
/*                                                                            */
/*  `copy.ts` is the founder sign-off surface, so it is worth having a machine */
/*  hold the parts of the review that a machine can hold: the house rule on    */
/*  em-dashes, and N4's ban on anything that reads as a score.                 */
/*                                                                            */
/*  This does not replace sign-off. It only stops the two failures that would  */
/*  otherwise be caught by eye, on a file long enough that eyes skip.          */
/* -------------------------------------------------------------------------- */

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
 *  match is ignored when it sits just after a negation in the same sentence.
 *  Naming what this surface deliberately does not have is the whole point of
 *  the guide's last paragraph. */
const NEGATED = /\b(no|not|never|without|nothing)\b[^.]{0,24}$/i;

function offends(text: string, pattern: RegExp): boolean {
  const re = new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`);
  for (const match of text.matchAll(re)) {
    if (!NEGATED.test(text.slice(0, match.index))) return true;
  }
  return false;
}

describe("the copy checker itself", () => {
  // Without this, a negation rule that swallowed everything would make the
  // fence tests below pass on copy that violates them.
  const banned = /\b(streaks?|scores?|consistency)\b/i;

  it("flags a real violation", () => {
    expect(offends("Your consistency score is high.", banned)).toBe(true);
    expect(offends("You are on a 12 day streak.", banned)).toBe(true);
  });

  it("allows the surface to say it has none of them", () => {
    expect(
      offends("There is no streak, no score, and nothing that counts.", banned)
    ).toBe(false);
  });

  it("does not let a negation in an earlier sentence excuse a later claim", () => {
    expect(offends("There is no ping. Your score is 40.", banned)).toBe(true);
  });
});

describe("panel copy", () => {
  it("has something to check", () => {
    // Guards the walker itself: a refactor that stopped finding strings would
    // otherwise make every assertion below pass vacuously.
    expect(ALL.length).toBeGreaterThan(60);
  });

  it("uses no em-dashes or en-dashes", () => {
    // Founder rule, same as the Journal's. Commas or periods.
    const offenders = ALL.filter((s) => /[—–]/.test(s.text));
    expect(offenders.map((s) => s.path)).toEqual([]);
  });

  it("surfaces no score, streak, percentage or consistency meter", () => {
    // N4 / AC-9. This surface must not invent a number the product spent a
    // year removing. Saying it HAS no streak is allowed; having one is not.
    const banned =
      /\b(streaks?|scores?|scored|scoring|consistency|percent(age)?|rating|ranked)\b/i;
    const offenders = ALL.filter((s) => offends(s.text, banned));
    expect(offenders.map((s) => s.path)).toEqual([]);
  });

  it("prints no percentage anywhere, negated or not", () => {
    const offenders = ALL.filter((s) => /\d\s?%/.test(s.text));
    expect(offenders.map((s) => s.path)).toEqual([]);
  });

  it("never tells the user they missed a day or fell behind", () => {
    // N3 / L-4. Not typing means living, not failing. ("Come back to it" about
    // the setup form is fine; it is about the form, not about the user.)
    const nudging =
      /\b(you missed|missed a day|fell behind|falling behind|don'?t forget|keep it up|haven'?t logged|days? in a row|get back on track)\b/i;
    const offenders = ALL.filter((s) => offends(s.text, nudging));
    expect(offenders.map((s) => s.path)).toEqual([]);
  });

  it("keeps every string the prompt flags for sign-off non-empty", () => {
    // A blank here ships a screen with nothing on it, which is worse than
    // unapproved copy.
    expect(copy.GUIDE.paragraphs.length).toBeGreaterThanOrEqual(3);
    expect(copy.CONSENT.points.length).toBeGreaterThanOrEqual(4);
    for (const point of copy.CONSENT.points) {
      expect(point.heading.trim()).not.toBe("");
      expect(point.body.trim()).not.toBe("");
    }
    expect(copy.DELETE.body.trim()).not.toBe("");
    for (const [key, text] of Object.entries(copy.EMPTY)) {
      expect(text.trim(), key).not.toBe("");
    }
  });

  it("has no copy for a state that no longer exists", () => {
    // A `#` typed before onboarding is finished falls through as ordinary chat
    // and stores nothing (BE 2026-07-26, superseding §6.2). There is no
    // redirect line, so there must be no copy for one: putting a string back
    // here would be putting the half-working tag back with it.
    expect("SETUP_GATE_REDIRECT" in copy).toBe(false);
  });

  it("says the delete cannot be undone", () => {
    expect(copy.DELETE.body.toLowerCase()).toMatch(/cannot be undone/);
  });

  it("states retention and both exits on the consent screen", () => {
    // L-6 requires what is stored, where, for how long, and that it can be
    // exported and hard-deleted.
    const consent = strings(copy.CONSENT)
      .map((s) => s.text)
      .join(" ")
      .toLowerCase();
    expect(consent).toMatch(/until you delete it|how long/);
    expect(consent).toMatch(/download/);
    expect(consent).toMatch(/erase|delete/);
  });

  it("does not pre-accept consent in its own label", () => {
    expect(copy.CONSENT.checkboxLabel.toLowerCase()).toMatch(/i have read/);
  });
});

/* -------------------------------------------------------------------------- */
/*  Reachability                                                               */
/*                                                                            */
/*  `SETUP_GATE_REDIRECT` sat in this file for four commits, described a       */
/*  mechanic, was asserted on by two tests, and was never rendered by anything.*/
/*  It read as shipped behaviour in every review. This is the fence that stops */
/*  the next one: copy that no component imports is copy that does not exist,  */
/*  and a founder signing off this file should be signing off what users       */
/*  actually see.                                                              */
/* -------------------------------------------------------------------------- */

const SRC = fileURLToPath(new URL("../../", import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Names imported from `@/lib/life/copy` anywhere in the app (not tests). */
function importedCopyNames(): Set<string> {
  const names = new Set<string>();
  // `[^}]` rather than a lazy `[\s\S]*?`: the lazy form starts matching at the
  // FIRST `import {` in the file and runs on until it reaches the copy import's
  // closing brace, capturing every import statement in between as one blob.
  // Excluding `}` pins the match to a single brace pair, and still spans lines,
  // which the longer import lists here need.
  const importFrom = /import\s*\{([^}]*)\}\s*from\s*["']@\/lib\/life\/copy["']/g;
  for (const file of walk(SRC)) {
    if (file.endsWith(join("lib", "life", "copy.ts"))) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(importFrom)) {
      for (const raw of match[1].split(",")) {
        const name = raw.trim().split(/\s+as\s+/)[0].trim();
        if (name) names.add(name);
      }
    }
  }
  return names;
}

describe("copy reachability", () => {
  it("extracts identifiers, not blobs", () => {
    // Guards the extractor, and this one has already earned its keep: a count
    // check alone passed while the regex was capturing three whole import
    // statements as a single "name", which silently reported live copy as
    // orphaned. Shape is the assertion that catches that; size is not.
    const names = [...importedCopyNames()];
    expect(names.length).toBeGreaterThan(3);
    for (const name of names) {
      expect(name, name).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it("has no export that nothing imports", () => {
    const imported = importedCopyNames();
    const orphans = Object.keys(copy).filter((name) => !imported.has(name));
    // An orphan is either copy for a screen that was never built, or copy for
    // a screen that was removed. Both read as shipped. Delete it or wire it.
    expect(orphans).toEqual([]);
  });
});
