import { describe, expect, it } from "vitest";
import {
  insertSegment,
  joinSegments,
  moveSegment,
  removeSegment,
  splitSegments,
  updateSegment,
} from "./documentSegments";

const DOC = "First part.\n\nSecond part.\n\nThird part.";

describe("splitSegments / joinSegments", () => {
  it("round-trips a BE-joined document byte for byte", () => {
    expect(joinSegments(splitSegments(DOC))).toBe(DOC);
  });

  it("drops blank parts and normalizes wider gaps", () => {
    expect(splitSegments("a\n\n\n\nb\n\n   \n\n")).toEqual(["a", "b"]);
  });

  it("is empty for an empty document", () => {
    expect(splitSegments("")).toEqual([]);
    expect(joinSegments([])).toBe("");
  });

  it("never splits inside a rich-marker token", () => {
    // A fold marker may legally contain a blank line; slicing it would leak
    // raw syntax into a draggable card.
    const withMarker = "Before.\n\n**bold\n\nstill bold**\n\nAfter.";
    const parts = splitSegments(withMarker);
    expect(parts.some((p) => p.includes("**bold\n\nstill bold**"))).toBe(true);
  });
});

describe("moveSegment", () => {
  const parts = ["a", "b", "c"];

  it("moves a part forward and backward", () => {
    expect(moveSegment(parts, 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveSegment(parts, 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("returns the SAME array for a no-op, so callers skip marking dirty", () => {
    expect(moveSegment(parts, 1, 1)).toBe(parts);
    expect(moveSegment(parts, 5, 0)).toBe(parts);
    expect(moveSegment(parts, -1, 0)).toBe(parts);
  });

  it("clamps an out-of-range destination to the ends", () => {
    expect(moveSegment(parts, 0, 99)).toEqual(["b", "c", "a"]);
    expect(moveSegment(parts, 2, -99)).toEqual(["c", "a", "b"]);
  });
});

describe("insertSegment", () => {
  const parts = ["a", "b"];

  it("inserts at the front, the middle and the end", () => {
    expect(insertSegment(parts, 0, "x")).toEqual(["x", "a", "b"]);
    expect(insertSegment(parts, 1, "x")).toEqual(["a", "x", "b"]);
    expect(insertSegment(parts, 2, "x")).toEqual(["a", "b", "x"]);
  });

  it("refuses blank words — a tap that adds nothing is not an edit", () => {
    expect(insertSegment(parts, 1, "   \n ")).toBe(parts);
  });

  it("trims the added words so the join stays canonical", () => {
    expect(joinSegments(insertSegment(parts, 2, "  x  "))).toBe("a\n\nb\n\nx");
  });
});

describe("updateSegment", () => {
  const parts = ["a", "b"];

  it("replaces one part's words", () => {
    expect(updateSegment(parts, 1, "z")).toEqual(["a", "z"]);
  });

  it("emptying a part removes it", () => {
    expect(updateSegment(parts, 0, "  ")).toEqual(["b"]);
  });

  it("is identity when nothing changed or the index is out of range", () => {
    expect(updateSegment(parts, 0, "a")).toBe(parts);
    expect(updateSegment(parts, 9, "z")).toBe(parts);
  });
});

describe("removeSegment", () => {
  it("drops the part and leaves the rest in order", () => {
    expect(removeSegment(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });

  it("is identity out of range", () => {
    const parts = ["a"];
    expect(removeSegment(parts, 3)).toBe(parts);
  });
});

describe("the whole-document contract", () => {
  it("an add then a move still produces ONE joined document", () => {
    let parts = splitSegments(DOC);
    parts = insertSegment(parts, 1, "Added part.");
    parts = moveSegment(parts, 3, 0);
    expect(joinSegments(parts)).toBe(
      "Third part.\n\nFirst part.\n\nAdded part.\n\nSecond part."
    );
  });
});
