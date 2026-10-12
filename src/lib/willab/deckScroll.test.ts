/* SPEC §11.3 (founder 2026-08-14): the chunk is the step, the slide is the
 * section. These pins hold the bubbling rule itself — the component wiring
 * is a thin shell around them. */
import { describe, expect, it } from "vitest";

import {
  stepPosition,
} from "./deckScroll";

const COUNTS = [3, 1, 2]; // slide 0: 3 chunks, slide 1: 1, slide 2: 2

describe("stepPosition — the §11.3 bubbling rule", () => {

  it("bubbles to the next slide ONLY from the final chunk", () => {
    expect(stepPosition(COUNTS, { slide: 0, chunk: 2 }, 1)).toEqual({
      slide: 1,
      chunk: 0,
    });
  });
});
