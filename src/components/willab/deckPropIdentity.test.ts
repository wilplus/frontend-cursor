/* -------------------------------------------------------------------------- */
/*  THE DECK'S INPUTS KEEP THEIR IDENTITY                                      */
/*  (founder 2026-09-19: "very laggy… bugging shaking screen when I scroll",   */
/*   "it shows part of it and then it expands with the slides after a short    */
/*   while")                                                                   */
/*                                                                            */
/*  Both surfaces built the slide zip inline in the JSX:                       */
/*                                                                            */
/*      pieceSlideIndexes={sd.pieces?.map((p) => p.slideIndex ?? null) ?? null}*/
/*                                                                            */
/*  `.map()` returns a NEW array every render, and so does a `?? []` literal.  */
/*  The deck memoises `grouping` on those props, `groups` on `grouping` and    */
/*  `screens` on `groups`, so a fresh identity at the top invalidated the      */
/*  whole chain: every render re-ran slide grouping and screen building for    */
/*  the entire document. The screen build MEASURES itself, so the wasted work  */
/*  landed on the scroll path and on the pass that decides how much text fits  */
/*  — which is exactly what a juddering scroll and a deck that expands a       */
/*  moment after it paints look like.                                         */
/*                                                                            */
/*  Asserted on source because identity is a property of the CALL SITE, not of */
/*  any value a render test can observe.                                      */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SURFACES = {
  "IdealTextOverlay.tsx": readFileSync(
    "src/components/willab/IdealTextOverlay.tsx",
    "utf8",
  ),
  "IdealTextReadout.tsx": readFileSync(
    "src/components/willab/IdealTextReadout.tsx",
    "utf8",
  ),
};

/** The props whose identity the deck's memo chain depends on. */
const MEMOISED_PROPS = [
  "pieceSlideIndexes",
  "piecePartIds",
  "suggestions",
] as const;

describe.each(Object.entries(SURFACES))("%s", (_name, source) => {
  it.each(MEMOISED_PROPS)(
    "hands the deck a stable %s, never a fresh array",
    (prop) => {
      // The value between `prop={` and its closing brace, allowing the
      // multi-line form prettier-less JSX tends to produce here.
      const match = source.match(
        new RegExp(`\\s${prop}=\\{([\\s\\S]{0,160}?)\\}\\n`),
      );
      expect(match, `${prop} is not passed to the deck at all`).toBeTruthy();
      const expression = match![1];

      expect(
        expression,
        `${prop} is built inline — a new array identity every render`,
      ).not.toMatch(/\.map\(/);
      expect(
        expression,
        `${prop} falls back to a fresh [] literal every render`,
      ).not.toMatch(/\?\?\s*\[\]/);
    },
  );

  it("memoises them on the read that produced them", () => {
    // `sd.pieces` only changes when a server read lands, which is the whole
    // point: the zip should be rebuilt then and at no other time.
    expect(source).toMatch(/const pieceSlideIndexes = useMemo\(/);
    expect(source).toMatch(/const piecePartIds = useMemo\(/);
    expect(source).toMatch(/\[sd\?\.pieces\]/);
  });
});
