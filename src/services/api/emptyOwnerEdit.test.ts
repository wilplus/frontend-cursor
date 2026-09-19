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
import { readFileSync } from "node:fs";
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

  it("still re-anchors a REAL edit", () => {
    // The empty-envelope guard must not disable the fix it sits in front of.
    const out = piecesForOwnerEdit(
      [piece("snap-a", 0), piece("snap-b", 1)],
      [{ id: "edit-a" }, { id: "edit-b" }],
    );

    expect(out?.map((p) => p.partId)).toEqual(["edit-a", "edit-b"]);
    expect(out?.map((p) => p.slideIndex)).toEqual([0, 1]);
  });

  it("still refuses a real edit whose paragraph count moved", () => {
    expect(
      piecesForOwnerEdit([piece("snap-a", 0), piece("snap-b", 1)], [{ id: "e" }]),
    ).toBeNull();
  });
});

describe("the mapper reads the edit for content, not for presence", () => {
  const SOURCE = readMapper();

  it("gates parts and pieces on the edit HAVING parts", () => {
    // Both lanes go through one derived value so they cannot drift apart: the
    // zip must follow the same list the deck is built from, or the comparison
    // between them is meaningless.
    expect(SOURCE).toContain(
      "ownerEdit && ownerEdit.parts.length > 0 ? ownerEdit.parts : null",
    );
    expect(SOURCE).toContain("parts: ownerEditParts");
    expect(SOURCE).toContain("pieces: ownerEditParts");
  });

  it("never gates either lane on the envelope's mere presence again", () => {
    expect(SOURCE).not.toContain("parts: ownerEdit\n");
    expect(SOURCE).not.toContain("pieces: ownerEdit\n");
  });
});

function readMapper(): string {
  return readFileSync("src/services/api/idealText.ts", "utf8");
}
