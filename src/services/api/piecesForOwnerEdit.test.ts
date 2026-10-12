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
});
