import { describe, expect, it } from "vitest";
import { DEFAULT_DECK } from "@/lib/willab/defaultDeck";
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
  it("keeps every uploaded PDF page as the visual layer", () => {
    const document = buildPresentationDocument({
      text: "Opening words\n\nClosing words",
      pieces: [piece(0, 0), piece(1, 2)],
      presentationRef: "https://example.test/deck.pdf",
      pageCount: 3,
      slideTitles: ["Opening", "Evidence", "Close"],
    });

    expect(document).toHaveLength(3);
    expect(document.map((slide) => slide.page)).toEqual([0, 1, 2]);
    expect(document.every((slide) => slide.hasVisual)).toBe(true);
    expect(document[0].rows[0].idealText).toBe("Opening words");
    expect(document[2].rows[0].idealText).toBe("Closing words");
  });

  it("always builds the canonical mock deck for a deckless project", () => {
    const document = buildPresentationDocument({
      text: "Premise\n\nDevelopment\n\nConclusion",
      pieces: null,
      presentationRef: null,
      pageCount: null,
      slideTitles: null,
    });

    expect(document).toHaveLength(DEFAULT_DECK.length);
    expect(document.map(({ title, body }) => ({ title, body }))).toEqual(
      DEFAULT_DECK.map(({ title, body }) => ({ title, body }))
    );
    expect(document.map((slide) => slide.artworkSrc)).toEqual(
      DEFAULT_DECK.map((slide) => slide.artworkSrc)
    );
    expect(document.map((slide) => slide.rows.length)).toEqual([1, 1, 1]);
  });

  it("does not guess unassigned text onto an uploaded slide", () => {
    const document = buildPresentationDocument({
      text: "One paragraph with no proven slide",
      pieces: null,
      presentationRef: "https://example.test/deck.pdf",
      pageCount: 2,
      slideTitles: null,
    });

    expect(document.slice(0, 2).every((slide) => slide.rows.length === 0)).toBe(
      true
    );
    expect(document[2]).toMatchObject({
      key: "unassigned-text",
      hasVisual: false,
    });
  });

  it("never invents roots and carries only accepted orange phrases", () => {
    const document = buildPresentationDocument({
      text: "Accepted paragraph\n\nUnrooted paragraph",
      pieces: [piece(0, 0, "flagship"), piece(1, 1, "neutral")],
      presentationRef: "https://example.test/deck.pdf",
      pageCount: 2,
      slideTitles: null,
    });

    expect(document[0].rows[0].rootPhrase).toBe("Root 0");
    expect(document[0].rows[0].rootType).toBe("flagship");
    expect(document[1].rows[0].rootPhrase).toBe("");
  });
});
