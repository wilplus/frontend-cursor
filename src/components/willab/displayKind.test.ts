import { describe, expect, it } from "vitest";
import { displayKind } from "./displayKind";
import type { DocumentSuggestion } from "@/services/api/idealText";

// The display taxonomy is founder copy (LIVE LOOP) — each word here is
// signed off, and a fall-through to the wrong word is unsigned copy on a
// student surface. The swap case is exactly how that happened once: it fell
// through to "Clarity" on a paragraph the student had deliberately settled.
const base: DocumentSuggestion = {
  id: "x", snippetId: "s", takeSessionId: "t", kind: "replace",
  quote: "q", proposedText: "p", device: null, why: null,
  source: null, status: "pending", blockKey: null,
  span: { start: 0, end: 1 },
} as unknown as DocumentSuggestion;

describe("displayKind", () => {
  it("labels the acoustic swap 'Delivery' — the founder's word for it", () => {
    expect(displayKind({ ...base, source: "acoustic_swap" })).toBe("Delivery");
  });

  it("…and checks source BEFORE kind, since a swap is kind=replace too", () => {
    expect(displayKind({ ...base, source: "acoustic_swap", kind: "replace" }))
      .toBe("Delivery");
  });

  it("keeps the existing words for the existing lanes", () => {
    expect(displayKind({ ...base, kind: "bold" })).toBe("Style");
    expect(displayKind({ ...base, kind: "advice" })).toBe("Flow");
    expect(displayKind({ ...base, why: "energy" })).toBe("Flow");
    expect(displayKind({ ...base })).toBe("Clarity");
  });
});
