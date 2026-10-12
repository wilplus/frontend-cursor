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
