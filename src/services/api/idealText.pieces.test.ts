/*
STORY    As a speaker, I want each paragraph placed on a slide only when the
         server says which one, so that a paragraph never lands on a guessed
         slide.
OUTCOME
  O1  A slide number outside the deck means no slide placement at all.
  O2  A paragraph without a slide number falls back to one paragraph per
      slide only when the counts match exactly.
PROVES   O1, O2 -> "an out-of-range or missing slide_index kills the explicit mapping"
*/
import { describe, expect, it } from "vitest";
import {
  slidePagesForParagraphs,
} from "@/lib/willab/pieceBadges";

describe("slidePagesForParagraphs (never a guessed slide)", () => {
  const withSlides = (idx: Array<number | null>) =>
    idx.map((slideIndex) => ({ slideIndex }));

  it("an out-of-range or missing slide_index kills the explicit mapping", () => {
    // Out of range → not even the count fallback may fire from bad indices…
    expect(slidePagesForParagraphs(3, withSlides([0, 1, 5]), 3)).toBeNull();
    // …but a piece row with NO index falls back to the exact-count zip.
    expect(slidePagesForParagraphs(3, withSlides([0, null, 2]), 3)).toEqual([
      0, 1, 2,
    ]);
  });
});
