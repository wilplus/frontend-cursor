import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  THE COACH'S WORD→SLIDE GROUND TRUTH — the FE half (founder 2026-08-11).     */
/*                                                                            */
/*  The plumbing here is ordinary; the LABEL DEFINITION is not, and it is the  */
/*  only part that can rot silently. A picker that asks the wrong question     */
/*  still saves rows, CI still passes, and the corpus quietly fills with       */
/*  answers to a question nobody meant to ask — which is worse than an empty   */
/*  table, because you cannot tell by looking.                                 */
/*                                                                            */
/*  So these assertions are mostly about words:                               */
/*    · the question names the SCREEN, not the subject matter;                */
/*    · the withdraw option says the pipeline was right, because that is a    */
/*      label too and deleting it throws away the evidence;                   */
/*    · every slide in the deck is offered, including the ones nobody spoke   */
/*      on — a forgotten advance strands words on exactly those.              */
/* -------------------------------------------------------------------------- */

const CTRL = readFileSync(
  "src/components/willab/SnippetSlideCorrection.tsx",
  "utf8"
);
const API = readFileSync("src/services/api/snippetSlide.ts", "utf8");
const ROUTE = readFileSync(
  "src/app/api/v2/coach/snippets/[snippetId]/slide/route.ts",
  "utf8"
);
const CARD = readFileSync(
  "src/components/willab/CoachSnippetReviewCard.tsx",
  "utf8"
);
const MAPPER = readFileSync("src/services/api/coachReview.ts", "utf8");

describe("the coach slide-correction affordance (founder 2026-08-11)", () => {
  it("asks what was ON SCREEN, never what the words are about", () => {
    // The north star buckets words to "the slide on screen when it was
    // spoken". A speaker who ran ahead of their own deck is NOT a bucketing
    // error, and a corpus that books it as one teaches the opposite of the
    // thing it exists to measure.
    expect(CTRL).toMatch(/on screen while this was said/i);
    expect(CTRL).toMatch(/not by what the words are about/i);
  });

  it("offers EVERY slide, not just the ones with words on them", () => {
    // The picker maps the whole deck. Building it from the snippets present
    // would hide exactly the slide a forgotten advance stranded — the case
    // the corpus most needs.
    expect(CTRL).toMatch(/slides\.map\(/);
    expect(CTRL).not.toMatch(/filter\([^)]*transcript/);
  });

  it("a withdrawal is an explicit label, not a delete", () => {
    expect(CTRL).toMatch(/the pipeline was right/i);
    expect(CTRL).toMatch(/send\(null\)/);
    expect(API).toMatch(/slide_index: slideIndex/);
  });

  it("the index crosses the wire as a NUMBER — nothing coerces it", () => {
    // The BE validates the index against the session's own deck. A layer
    // that coerced "2" into 2 would turn a UI bug into a fabricated label.
    expect(API).toMatch(/slideIndex: number \| null/);
    expect(ROUTE).toMatch(/body \|\| "\{\}"/);
    expect(ROUTE).not.toMatch(/JSON\.parse/);
    expect(ROUTE).not.toMatch(/Number\(/);
  });

  it("the route goes through the shared proxy, not a hand-rolled fetch", () => {
    expect(ROUTE).toMatch(/callBackend\(/);
    expect(ROUTE).not.toMatch(/await fetch\(/);
  });

  it("the control lives where the coach already sees slide AND words", () => {
    // The one moment in the product where the judgment is cheap and
    // reliable: the slide is rendered directly above the transcript.
    expect(CARD).toMatch(/<SnippetSlideCorrection/);
    expect(CARD).toMatch(/mappedIndex=\{snippet\.slide \? snippet\.slide\.index : null\}/);
    expect(CARD.indexOf("<SlideRender")).toBeLessThan(
      CARD.indexOf("<SnippetSlideCorrection")
    );
  });

  it("the deck reaches the card — the mapper no longer drops it", () => {
    expect(MAPPER).toMatch(/slides: ReadoutSlide\[\]/);
    expect(MAPPER).toMatch(/slides: Array\.isArray\(r\.slides\)/);
  });

  it("nothing here reaches a user surface (AC-9)", () => {
    // Coach-only by CONSTRUCTION, checked by walking the tree: the control
    // may be mounted in the coach review card and nowhere else. A student
    // surface that grew this picker would be asking users to grade the
    // pipeline, which is both a score and the wrong labeller.
    const importers = walk("src/components")
      .concat(walk("src/app"))
      .filter((f) => !f.endsWith("slideCorrection.test.ts"))
      .filter((f) => /from "\.[^"]*SnippetSlideCorrection"/.test(readFileSync(f, "utf8")));
    expect(importers).toEqual([
      "src/components/willab/CoachSnippetReviewCard.tsx",
    ]);
    expect(CTRL).not.toMatch(/score|confidence|accuracy/i);
  });
});
