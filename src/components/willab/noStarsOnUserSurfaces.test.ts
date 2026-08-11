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

  it("scans a real, non-trivial file set — a fence over nothing is not a fence", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it("NO component draws a star icon — user lane or coach lane", () => {
    const offenders = files.filter((f) => drawsAStar(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the coach's verdict lane still marks its rows — the glyph changed, the labelling flow did not", () => {
    // The rip must not read as "the coach tool lost its affordance": the row
    // still carries a mark, it is simply a neutral one.
    const overlay = readFileSync(
      "src/components/willab/CoachStarVerdictOverlay.tsx",
      "utf8"
    );
    expect(overlay).toMatch(/<BadgeCheck/);
  });

  it("the star RENDERERS are gone from the tree, not merely unmounted", () => {
    // MomentStars/TrackedText were the star lane's own modules; PieceBadgeText
    // was the badged reading view that mounted them. A file that still exists
    // is a file the next feature can mount again.
    const gone = [
      "src/components/willab/MomentStars.tsx",
      "src/components/willab/TrackedText.tsx",
    ];
    for (const f of gone) {
      expect(files).not.toContain(f);
    }
    // The DECLARATION, not the name: the surviving file's header explains
    // what was removed and why, and that record is worth keeping.
    const pieceBadges = readFileSync(
      "src/components/willab/PieceBadges.tsx",
      "utf8"
    );
    expect(pieceBadges).not.toMatch(/export function PieceBadgeText/);
  });
});
