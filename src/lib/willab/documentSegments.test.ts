import { describe, expect, it } from "vitest";
import {
  joinSegments,
  splitSegments,
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
