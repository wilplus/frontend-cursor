/*
GUARD    No component in src/components or src/app draws a star icon.
CATCHES  Never 1 (no verdicts shown to speakers): a `<Star` element or a lucide
         `Star` import in any .tsx, user lane or coach lane. A source scan on
         purpose: the star rating once lived in six separate renderers, and a
         render test only covers the surface it mounts.
IF REMOVED  A star rating (a verdict) can quietly come back on any screen.
PROVES   star drawn -> "NO component draws a star icon"
WHY      Founder 2026-08-11: "no stars anywhere else, rip them off".
*/
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/components", "src/app"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** The star ICON, in the two shapes it can reach a screen: a JSX element, or
 *  a lucide import specifier. Word-boundaried so `StarVerdict`, `starVerdicts`
 *  and prose about "Star Verdict" are not false positives — the fence is
 *  about what RENDERS, never about the vocabulary of the coach's tool. */
function drawsAStar(source: string): boolean {
  if (/<Star[\s/>]/.test(source)) return true;
  const lucide = source.match(/import\s*\{([^}]*)\}\s*from\s*"lucide-react"/);
  return lucide ? /\bStar\b/.test(lucide[1]) : false;
}

describe("no stars on user surfaces (founder 2026-08-11)", () => {
  const files = ROOTS.flatMap((r) => walk(r));

  it("NO component draws a star icon", () => {
    // The scan sees files, and it would see a star if one were there.
    expect(files.length).toBeGreaterThan(0);
    expect(drawsAStar('import { Check, Star } from "lucide-react";')).toBe(true);
    expect(drawsAStar("<Star size={12} />")).toBe(true);
    expect(drawsAStar("<StarVerdict />")).toBe(false);
    const offenders = files.filter((f) => drawsAStar(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
