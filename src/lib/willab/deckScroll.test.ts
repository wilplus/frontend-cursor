/*
 * STORY    As a speaker, I want Next in the deck to go chunk by chunk and move
 *          to the next slide only after its last chunk, so that I never skip
 *          a paragraph.
 * OUTCOME
 *   O1  From a slide's last chunk, Next lands on the next slide's first chunk.
 *   O2  From any other chunk, Next stays on the same slide, one chunk on.
 * PROVES   O1, O2 -> "bubbles to the next slide ONLY from the final chunk"
 * WHY      SPEC §11.3 (founder 2026-08-14): the chunk is the step, the slide the section.
 */
import { describe, expect, it } from "vitest";

import { stepPosition } from "./deckScroll";

const COUNTS = [3, 1, 2]; // slide 0: 3 chunks, slide 1: 1, slide 2: 2

describe("stepPosition", () => {
  it("bubbles to the next slide ONLY from the final chunk", () => {
    expect(stepPosition(COUNTS, { slide: 0, chunk: 2 }, 1)).toEqual({ slide: 1, chunk: 0 });
    expect(stepPosition(COUNTS, { slide: 0, chunk: 0 }, 1)).toEqual({ slide: 0, chunk: 1 });
  });
});
