import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/* -------------------------------------------------------------------------- */
/*  THE STAR FENCE (founder 2026-08-11, verbatim: "O stars at all the voice    */
/*  confident feedback is just a feedback; so treat it as such and no stars    */
/*  anywhere else, rip them off").                                            */
/*                                                                            */
/*  A source scan, not a render test, and deliberately so: the star lane died  */
/*  as SIX separate renderers (the moment text, the tracked layer, the badged  */
/*  reading view, the rich-text decor, the pending pill, the advice mark), and */
/*  a render test only ever covers the surface it mounts. What must hold is a  */
/*  property of the code: no USER-lane file draws a star.                     */
/*                                                                            */
/*  NOTHING IS EXEMPT (founder 2026-08-11, second pass: "Let's eradicate       */
/*  'stars' completely across the entire platform"). The coach's star-verdict  */
/*  review kept its icon for one slice; it now wears a neutral approval mark   */
/*  like everything else. The labelling FLOW is untouched — only the glyph     */
/*  changed — so this fence costs the coach nothing and leaves no corner       */
/*  where a star can quietly return.                                          */
/* -------------------------------------------------------------------------- */

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

  it("NO component draws a star icon — user lane or coach lane", () => {
    const offenders = files.filter((f) => drawsAStar(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
