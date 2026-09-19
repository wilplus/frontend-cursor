/* -------------------------------------------------------------------------- */
/*  AN EDIT MUST NOT COST THE DOCUMENT ITS SLIDES                              */
/*  (founder 2026-09-19: "keep my edits rendering and fix the pieces side")    */
/*                                                                            */
/*  The core read serves three things that have to agree: the text, the parts  */
/*  that carry Paragraph identity, and the pieces that carry the Paragraph →   */
/*  Slide mapping. When an owner edit exists the mapper switched the first two */
/*  to the edit and left the third on the snapshot — so the deck held the      */
/*  edit's part ids while the zip held the snapshot's, `groupChunksBySlide`    */
/*  rejected the document at index 0 with `piece_identity_mismatch`, and the   */
/*  deck collapsed into one unlinked section: no slide kickers, and no slide   */
/*  picture, because the preview renders per slide group.                      */
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

const editPart = (id: string) => ({ id });

describe("the slide zip follows the owner edit's identity", () => {
  it("re-anchors every piece onto the edit's part id", () => {
    const out = piecesForOwnerEdit(
      [piece("snap-a", 0), piece("snap-b", 1), piece("snap-c", 2)],
      [editPart("edit-a"), editPart("edit-b"), editPart("edit-c")],
    );

    expect(out?.map((p) => p.partId)).toEqual(["edit-a", "edit-b", "edit-c"]);
  });

  it("keeps the slide mapping itself untouched", () => {
    // Only identity is re-anchored. Which slide a paragraph sits on is the
    // machine's provenance and is never re-derived here.
    const out = piecesForOwnerEdit(
      [piece("snap-a", 0), piece("snap-b", 0), piece("snap-c", 3)],
      [editPart("edit-a"), editPart("edit-b"), editPart("edit-c")],
    );

    expect(out?.map((p) => p.slideIndex)).toEqual([0, 0, 3]);
  });

  it("refuses when a paragraph was added or removed", () => {
    // Unequal counts mean slot N is no longer provably the same Paragraph, so
    // there is no honest way to say which Slide the edited one belongs to.
    // Null degrades to the unlinked view rather than guessing.
    expect(
      piecesForOwnerEdit(
        [piece("snap-a", 0), piece("snap-b", 1)],
        [editPart("edit-a")],
      ),
    ).toBeNull();

    expect(
      piecesForOwnerEdit(
        [piece("snap-a", 0)],
        [editPart("edit-a"), editPart("edit-b")],
      ),
    ).toBeNull();
  });

  it("passes an absent or empty zip straight through", () => {
    // "No stored mapping" and "a mapping that disagrees" are different states
    // and only the second one is this function's business.
    expect(piecesForOwnerEdit(null, [editPart("edit-a")])).toBeNull();
    expect(piecesForOwnerEdit([], [editPart("edit-a")])).toEqual([]);
  });

  it("does not mutate the pieces it was given", () => {
    const original = [piece("snap-a", 0)];
    piecesForOwnerEdit(original, [editPart("edit-a")]);
    expect(original[0].partId).toBe("snap-a");
  });
});
