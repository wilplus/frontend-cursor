import { describe, expect, it } from "vitest";
import { buildPresentationDocument } from "@/lib/willab/presentationDocument";
import type { IdealPiece } from "@/services/api/idealText";

function piece(
  pieceKey: number,
  slideIndex: number,
  rootType: "flagship" | "neutral" = "neutral",
): IdealPiece {
  return {
    pieceKey,
    slideIndex,
    text: `Paragraph ${pieceKey}`,
    rootPhrase: `Root ${pieceKey}`,
    rootType,
    takeIndex: 1,
    snippetId: `snippet-${pieceKey}`,
    takeSessionId: "take-1",
    status: "settled",
    challenger: null,
  };
}

describe("buildPresentationDocument", () => {

  // Phase 5: words saved on the Slide (practice, an earlier Take) reach the
  // delivery and the export, as the page draws them. LAST CONFIGURATION
  // (founder 2026-10-05): once read, the page's words are the whole answer --
  // a paragraph absent from them (its words deleted) shows none, never the
  // older words its piece still carries.
  it("takes each paragraph's helper words from the page's headlines, and only from them", () => {
    const withPart = (p: IdealPiece, partId: string): IdealPiece => ({ ...p, partId });
    const document = buildPresentationDocument({
      text: "Opening words\n\nClosing words",
      pieces: [withPart(piece(0, 0, "flagship"), "part-a"), withPart(piece(1, 1), "part-b")],
      presentationRef: null,
      pageCount: null,
      slideTitles: null,
      headlines: new Map([["part-b", "closing words"]]),
    });
    const rows = document.flatMap((slide) => slide.rows);
    expect(rows.map((r) => [r.rootPhrase, r.rootType])).toEqual([
      ["", "neutral"],
      ["closing words", "flagship"],
    ]);
  });
});
