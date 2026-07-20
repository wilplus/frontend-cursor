import { describe, expect, it } from "vitest";
import { mapIdealPieces, type IdealPiece } from "./idealText";
import {
  latestTakeIndex,
  sliceSegmentsByParagraphs,
  splitBadgeParagraphSpans,
  splitBadgeParagraphs,
} from "@/lib/willab/pieceBadges";
import { segmentIdealText } from "./idealText";

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
    expect(v?.[1]).toMatchObject({
      status: "pending_swap",
      challenger: { snippetId: "c1", takeIndex: 3, why: "energy" },
    });
  });

  it("degrades pending WITHOUT a usable challenger to settled (no dead glow)", () => {
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

describe("sliceSegmentsByParagraphs (document-level star matching)", () => {
  const moments = (anchors: string[]) =>
    anchors.map((a, i) => ({
      anchor: a,
      snippetId: `s${i}`,
      takeSessionId: `t${i}`,
    }));

  it("a recurring anchor stars ONCE, at its document-first occurrence", () => {
    // "we can do this" appears in both paragraphs; per-paragraph matching
    // would star both (review R-db1). Document-level slicing keeps one.
    const text = "I think we can do this today.\n\nWe can do this.";
    const segs = segmentIdealText(text, [], moments(["we can do this"]));
    const spans = splitBadgeParagraphSpans(text);
    const out = sliceSegmentsByParagraphs(segs, spans);
    expect(out).not.toBeNull();
    const starred = out!.map((para) => para.filter((s) => s.moment).length);
    expect(starred).toEqual([1, 0]);
  });

  it("plain segments slice at boundaries; separators fall away", () => {
    const text = "alpha beta\n\ngamma delta";
    const segs = segmentIdealText(text, [], moments(["gamma"]));
    const out = sliceSegmentsByParagraphs(segs, splitBadgeParagraphSpans(text));
    expect(out![0].map((s) => s.text).join("")).toBe("alpha beta");
    expect(out![1].map((s) => s.text).join("")).toBe("gamma delta");
    expect(out![1][0].moment).toBeTruthy();
  });

  it("nulls when a styled range would straddle a paragraph boundary", () => {
    const text = "one two\n\nthree four";
    // A hand-built styled segment spanning the boundary (segmentIdealText
    // itself can't produce this today; the guard is for future shapes).
    const segs = [
      { text: "one " },
      { text: "two\n\nthree", bold: true },
      { text: " four" },
    ];
    expect(
      sliceSegmentsByParagraphs(segs, splitBadgeParagraphSpans(text))
    ).toBeNull();
  });
});

describe("latestTakeIndex", () => {
  const base = {
    pieceKey: 0,
    text: "x",
    snippetId: "s",
    takeSessionId: "t",
    status: "settled" as const,
    challenger: null,
  };
  it("takes the max across incumbents AND challengers", () => {
    const pieces: IdealPiece[] = [
      { ...base, takeIndex: 1 },
      {
        ...base,
        pieceKey: 1,
        takeIndex: 2,
        status: "pending_swap",
        challenger: { snippetId: "c", takeIndex: 3, text: "y", why: null },
      },
    ];
    expect(latestTakeIndex(pieces)).toBe(3);
  });
  it("null when nothing carries an index", () => {
    expect(latestTakeIndex([{ ...base, takeIndex: null }])).toBeNull();
  });
});
