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
const MARK = code("src/components/willab/DeckLockMark.tsx");
const CHUNKS = code("src/lib/willab/deckChunks.ts");
const READOUT = code("src/components/willab/IdealTextReadout.tsx");

describe("the deck surface the founder specced (2026-08-11)", () => {
  it("nothing paints the chunk text — no underline, no wash, no tint", () => {
    // The rule that made the whole screen unreadable when a talk arrived as
    // one chunk: a single pending note striped 233 words amber.
    expect(DECK).not.toMatch(/underline/);
    expect(DECK).not.toMatch(/bg-pending/);
    expect(DECK).not.toMatch(/decoration-/);
    expect(DECK).not.toMatch(/CHUNK_TEXT_CLS/);
  });

  it("the chunk renders its words directly, with the mark beside them", () => {
    // Not merely "no classes today" — no wrapper to hang classes ON.
    expect(DECK).toMatch(/<RichText text=\{c\.part\.text\} \/>\s*<DeckLockMark/);
  });

  it("there are THREE chunk states", () => {
    expect(CHUNKS).toMatch(
      /export type ChunkStatus =\s*"clean" \| "waiting" \| "locked";/
    );
    expect(CHUNKS).not.toMatch(/"accepted"/);
    // Precedence that had to survive the merge: a server lock still wins,
    // and outstanding feedback still beats an already-decided suggestion.
    expect(CHUNKS).toMatch(/locked\s*\?\s*"locked"/);
    expect(CHUNKS).toMatch(/pendingIds\.length > 0\s*\?\s*"waiting"/);
  });

  it("the mark carries all three states and no fourth", () => {
    for (const state of ["clean:", "waiting:", "locked:"]) {
      expect(MARK).toContain(state);
    }
    expect(MARK).not.toMatch(/accepted:/);
  });

  it("the deck has no footer — no review count, no position, no word count", () => {
    expect(DECK).not.toMatch(/to review/);
    expect(DECK).not.toMatch(/Nothing waiting/);
    expect(DECK).not.toMatch(/words/);
    expect(DECK).not.toMatch(/Slide \$\{atSlide/);
    // The dots rail is the surviving "where am I" — it must NOT go with it.
    expect(DECK).toMatch(/groups\.length > 1/);
    expect(DECK).toMatch(/aria-current/);
  });

  it("the readout screen has exactly ONE scroller — the deck", () => {
    // Founder 2026-08-11: "this whole screen is movable and should not be…
    // I can scroll on the slides and on the page, it is one". Two nested
    // scrollers means the slide moves under your thumb and the card moves
    // behind it, and neither gesture is the one you meant. The host band
    // stops scrolling on this state; the deck's snap-scroll is the movement.
    const LAB = code("src/components/willab/LabOverlay.tsx");
    expect(LAB).toMatch(
      /state === "readout" \? "min-h-0 overflow-hidden" : "overflow-y-auto"/
    );
    // A MINIMUM height on the deck is what forced the page past the phone.
    // It takes the height that is left, so every link in the chain must be
    // allowed to shrink.
    expect(READOUT).not.toMatch(/min-h-\[\d+rem\][^"]*flex-1 flex-col overflow-hidden/);
    expect(READOUT).toMatch(/flex min-h-0 flex-1 flex-col overflow-hidden/);
    expect(READOUT).toMatch(/flex min-h-0 flex-1 flex-col gap-4/);
  });

  it("the deck mount has no frame and no height cap", () => {
    const mount = READOUT.slice(
      READOUT.indexOf("<TranscriptReviewDeck") - 400,
      READOUT.indexOf("<TranscriptReviewDeck")
    );
    expect(mount).not.toMatch(/border/);
    expect(mount).not.toMatch(/\bh-\[\d+vh\]/);
  });
});
