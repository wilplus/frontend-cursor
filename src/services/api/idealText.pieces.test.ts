import { describe, expect, it } from "vitest";
import { mapIdealPieces } from "./idealText";
import {
  slidePagesForParagraphs,
  splitBadgeParagraphs,
} from "@/lib/willab/pieceBadges";

/* DISCERNMENT (founder 2026-07-20) — the version-badge layer's pure logic. */

describe("mapIdealPieces", () => {
  it("maps the wire shape; absent key means NO badge layer (null, not [])", () => {
    expect(mapIdealPieces(undefined)).toBeNull();
    expect(mapIdealPieces(null)).toBeNull();
    expect(mapIdealPieces("nope")).toBeNull();
    const v = mapIdealPieces([
      {
        piece_key: 0,
        text: "first words",
        take_index: 1,
        snippet_id: "s1",
        take_session_id: "t1",
        status: "settled",
        challenger: null,
      },
      {
        piece_key: 1,
        text: "second words",
        take_index: 2,
        snippet_id: "s2",
        take_session_id: "t2",
        status: "pending_swap",
        challenger: {
          snippet_id: "c1",
          take_index: 3,
          text: "the newer words",
          why: "energy",
        },
      },
    ]);
    expect(v).toHaveLength(2);
    expect(v?.[0]).toMatchObject({
      pieceKey: 0,
      takeIndex: 1,
      status: "settled",
      challenger: null,
    });
    // The swap decision is retired (audit C3): a stray pending_swap row reads
    // as settled; its challenger still counts toward the newest take.
    expect(v?.[1]).toMatchObject({
      status: "settled",
      challenger: { snippetId: "c1", takeIndex: 3, why: "energy" },
    });
  });

  it("reads pending WITHOUT a usable challenger as settled too", () => {
    const v = mapIdealPieces([
      {
        piece_key: 0,
        text: "words",
        take_index: 1,
        snippet_id: "s1",
        take_session_id: "t1",
        status: "pending_swap",
        challenger: { snippet_id: "", text: "" },
      },
    ]);
    expect(v?.[0].status).toBe("settled");
    expect(v?.[0].challenger).toBeNull();
  });

  it("clamps unknown why to null (no line, never guess) and drops broken rows", () => {
    const v = mapIdealPieces([
      { piece_key: 0, text: "", take_index: 1 }, // no text → dropped
      { nonsense: true },
      {
        piece_key: 2,
        text: "kept",
        take_index: 0, // 0 is not a valid 1-based take → null (no pill)
        snippet_id: "s",
        take_session_id: "t",
        status: "pending_swap",
        challenger: {
          snippet_id: "c",
          take_index: 4,
          text: "alt",
          why: "confidence_delta", // internal vocab must never reach copy
        },
      },
    ]);
    expect(v).toHaveLength(1);
    expect(v?.[0].takeIndex).toBeNull();
    expect(v?.[0].challenger?.why).toBeNull();
  });
});

describe("splitBadgeParagraphs", () => {
  it("splits on blank lines, dropping empty parts", () => {
    expect(splitBadgeParagraphs("a\n\nb\n\n\nc")).toEqual(["a", "b", "c"]);
    expect(splitBadgeParagraphs("")).toEqual([]);
    expect(splitBadgeParagraphs("only one")).toEqual(["only one"]);
  });

  it("never splits inside a rich-marker token (the safe merge degrade)", () => {
    // The orange marker legally contains a blank line — splitting there would
    // leak raw syntax; the two halves stay one paragraph instead.
    const text = "start {{orange:one\n\ntwo}} end\n\nnext";
    expect(splitBadgeParagraphs(text)).toEqual([
      "start {{orange:one\n\ntwo}} end",
      "next",
    ]);
  });
});

describe("mapIdealPieces — slide_index (slides layer, safe-ahead)", () => {
  const row = (extra: Record<string, unknown>) => ({
    piece_key: 0,
    text: "words",
    take_index: 1,
    snippet_id: "s",
    take_session_id: "t",
    status: "settled",
    challenger: null,
    ...extra,
  });
  it("reads a 0-based slide_index; absent/negative/junk degrade to null", () => {
    expect(mapIdealPieces([row({ slide_index: 2 })])?.[0].slideIndex).toBe(2);
    expect(mapIdealPieces([row({ slide_index: 0 })])?.[0].slideIndex).toBe(0);
    expect(mapIdealPieces([row({})])?.[0].slideIndex).toBeNull();
    expect(mapIdealPieces([row({ slide_index: -1 })])?.[0].slideIndex).toBeNull();
    expect(mapIdealPieces([row({ slide_index: "2" })])?.[0].slideIndex).toBeNull();
  });
});

describe("slidePagesForParagraphs (never a guessed slide)", () => {
  const withSlides = (idx: Array<number | null>) =>
    idx.map((slideIndex) => ({ slideIndex }));

  it("per-piece slide_index wins when every piece carries one in range", () => {
    expect(slidePagesForParagraphs(3, withSlides([0, 0, 2]), 4)).toEqual([
      0, 0, 2,
    ]);
  });

  it("an out-of-range or missing slide_index kills the explicit mapping", () => {
    // Out of range → not even the count fallback may fire from bad indices…
    expect(slidePagesForParagraphs(3, withSlides([0, 1, 5]), 3)).toBeNull();
    // …but a piece row with NO index falls back to the exact-count zip.
    expect(slidePagesForParagraphs(3, withSlides([0, null, 2]), 3)).toEqual([
      0, 1, 2,
    ]);
  });

  it("without pieces: paragraph i = page i ONLY on an exact count match", () => {
    expect(slidePagesForParagraphs(3, null, 3)).toEqual([0, 1, 2]);
    expect(slidePagesForParagraphs(3, null, 4)).toBeNull();
    expect(slidePagesForParagraphs(4, null, 3)).toBeNull();
  });

  it("no pages / nothing to map → null", () => {
    expect(slidePagesForParagraphs(3, null, null)).toBeNull();
    expect(slidePagesForParagraphs(0, null, 3)).toBeNull();
    expect(slidePagesForParagraphs(3, null, 0)).toBeNull();
  });
});
