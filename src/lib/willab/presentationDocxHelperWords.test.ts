/* The Word export follows clause 20 (founder 2026-09-28, decision 6A): the
   helper words are italic inside their paragraph, in its own colour — the
   orange belongs to the headline above it. */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/willab/presentationVisuals", () => ({}));

import { docxHeadline, docxTextSegments, idealTextSegments } from "./presentationDocx";

/* Every headline is drawn orange and bold, a flagship row's and a neutral
   row's alike (founder 2026-10-07, Q-B9 A: the walk's orange rule applies
   inside the walk only; build plan D-IT-10). There is no grey branch, and the
   words are italic inside the paragraph for both. */
describe("the headline's colour, for both kinds of row", () => {
  const ORANGE = "E56F2D";
  const flagship = { rootPhrase: "the timing matters", rootType: "flagship", idealText: "We think the timing matters here." };
  const neutral = { rootPhrase: "one more quarter", rootType: "neutral", idealText: "Give it one more quarter please." };

  it("a flagship row's headline is orange and bold", () => {
    expect(docxHeadline(flagship)).toEqual({ text: "the timing matters", color: ORANGE, bold: true });
  });

  it("a neutral row's headline is orange and bold too — no grey branch", () => {
    expect(docxHeadline(neutral)).toEqual({ text: "one more quarter", color: ORANGE, bold: true });
  });

  it("a row without helper words has no headline", () => {
    expect(docxHeadline({ rootPhrase: "" })).toBeNull();
  });

  it("the words are italic inside the paragraph for both kinds of row", () => {
    for (const row of [flagship, neutral]) {
      const italic = docxTextSegments(row).filter((s) => s.italics).map((s) => s.text);
      expect(italic).toEqual([row.rootPhrase]);
    }
  });
});

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
