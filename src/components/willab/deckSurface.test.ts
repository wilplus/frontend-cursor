import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* -------------------------------------------------------------------------- */
/*  THE STRIPPED DECK SURFACE (founder 2026-08-11)                             */
/*                                                                            */
/*  Four rulings, all of them subtractions, and subtractions are exactly what  */
/*  creeps back: a later change adds a tint "just for the pending case", a     */
/*  count "just in the corner", a border "so it reads as a card". Each one is  */
/*  defensible on its own and together they rebuild the screen the founder     */
/*  asked to have taken apart.                                                */
/*                                                                            */
/*    1. the text is NEVER painted — no underline, no wash, in any state;      */
/*    2. three chunk states, not four — accepted and locked are one;           */
/*    3. no frame and no height cap around the deck;                          */
/*    4. no footer at all — no review count, no slide position, no words.      */
/* -------------------------------------------------------------------------- */

/** Source with COMMENTS STRIPPED. Every rule below is about what RENDERS, and
 *  the files explain at length which treatments were retired and why — prose
 *  that names "underline" and "accepted" repeatedly. Scanning the raw text
 *  would fail on the record of the decision rather than on a breach of it. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const DECK = code("src/components/willab/TranscriptReviewDeck.tsx");

describe("the deck surface the founder specced (2026-08-11)", () => {

  it("the deck has no footer — no review count, no position, no word count", () => {
    expect(DECK).not.toMatch(/to review/);
    expect(DECK).not.toMatch(/Nothing waiting/);
    expect(DECK).not.toMatch(/words/);
    expect(DECK).not.toMatch(/Slide \$\{atSlide/);
    // No dots rail either: top bar, slide row, paragraphs, foot (lock
    // 2026-10-12, section 4).
    expect(DECK).not.toMatch(/aria-current/);
  });

  /* ── THE KEYBOARD (founder 2026-09-22) ──────────────────────────────────
   * "on the keyboard if I click it it scrolls one slide." It used to step
   * one CHUNK, which since screens are packed to fit meant scrolling an
   * inner scroller that had nowhere to go — so every press but the last of
   * a screen moved nothing and read as the key being ignored. */

});

