/* -------------------------------------------------------------------------- */
/*  AN EMPTY OWNER EDIT IS NOT AN OWNER EDIT                                   */
/*  (production, 2026-09-19 — "the text skipped the slides and got             */
/*  concatenated again", on a document whose snapshot was perfect)             */
/*                                                                            */
/*  `mapConfidentMomentOwnerEdit` returns a real object — {text: null,         */
/*  parts: []} — for "no edit yet", which is the ordinary state of almost      */
/*  every document. The mapper tested it for PRESENCE, so `parts` was set to   */
/*  the empty list; `partsForDocument` then saw nothing served, fell through   */
/*  to `reconcileParts`, and minted a fresh id for every Paragraph. The zip    */
/*  still held the server's ids, so the deck failed at index 0 with            */
/*  `piece_identity_mismatch` and collapsed into one unlinked section — no     */
/*  slide kickers, and no slide picture, because the preview renders per       */
/*  slide group.                                                              */
/*                                                                            */
/*  Four database queries said the snapshot was flawless, and it was. The      */
/*  document was destroyed on the way to the screen by a truthiness check.     */
/* -------------------------------------------------------------------------- */
import { describe, expect, it } from "vitest";
import { piecesForOwnerEdit, type IdealPiece } from "./idealText";

const piece = (partId: string, slideIndex: number | null): IdealPiece => ({
  pieceKey: 0,
  partId,
  blockKey: null,
  slideIndex,
  text: "words",
  rootPhrase: "",
  rootType: "neutral",
  takeIndex: null,
  snippetId: "",
  takeSessionId: "",
  status: "settled",
  challenger: null,
});

describe("the empty envelope never displaces the served mapping", () => {
  it("passes the zip through untouched when the edit has no parts", () => {
    // The regression this replaces: an 8-vs-0 length check returned null, and
    // a `piece_identity_mismatch` became a `missing_slide_mapping` — strictly
    // worse, because the mapping that was discarded was still correct.
    const pieces = [piece("snap-a", 0), piece("snap-b", 1)];

    expect(piecesForOwnerEdit(pieces, [])).toBe(pieces);
  });
});
