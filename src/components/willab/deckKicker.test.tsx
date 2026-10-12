// @vitest-environment jsdom
/* The Ideal Text page's kicker reads "Slide n of m" (Ideal Text Final
   Screens: "SLIDE 2 OF 6", capitals by CSS; build plan D-IT-1). A text with
   no deck keeps "Your talk", and the copied text keeps naming a slide
   "Slide n", unchanged. */
import { describe, expect, it, vi } from "vitest";

vi.mock("./pdfSlides", () => ({
  PdfPage: () => null,
  MockPresentationSlide: () => null,
  SlideRender: () => null,
}));

import { kickerFor } from "./TranscriptReviewDeck";

describe("kickerFor", () => {
  it("reads Slide n of m", () => {
    expect(kickerFor(1, 6)).toBe("Slide 2 of 6");
    expect(kickerFor(0, 1)).toBe("Slide 1 of 1");
    expect(kickerFor(5, 6)).toBe("Slide 6 of 6");
  });

  it("keeps Your talk for a text with no deck", () => {
    expect(kickerFor(null, 6)).toBe("Your talk");
    expect(kickerFor(null, null)).toBe("Your talk");
  });

  it("never invents a length it does not know", () => {
    expect(kickerFor(1, null)).toBe("Slide 2");
    expect(kickerFor(1, 0)).toBe("Slide 2");
    // A slide past the known titles: no "of m" smaller than n.
    expect(kickerFor(7, 6)).toBe("Slide 8");
  });

});
