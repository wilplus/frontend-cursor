/* The Word export follows clause 20 (founder 2026-09-28, decision 6A): the
   helper words are italic inside their paragraph, in its own colour — the
   orange belongs to the headline above it. */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/willab/presentationVisuals", () => ({}));

import { idealTextSegments } from "./presentationDocx";

describe("helper words in the exported paragraph", () => {
  it("are italic where they occur and nowhere else", () => {
    const segments = idealTextSegments(
      "But you can just remember a few words, key phrases.",
      "just remember a few words",
    );
    expect(segments.filter((s) => s.italics).map((s) => s.text)).toEqual([
      "just remember a few words",
    ]);
    expect(segments.map((s) => s.text).join("")).toBe(
      "But you can just remember a few words, key phrases.",
    );
  });

  it("leave a paragraph without helper words untouched", () => {
    const segments = idealTextSegments("Hello everybody.", null);
    expect(segments).toEqual([
      { text: "Hello everybody.", bold: false, italics: false },
    ]);
  });
});
