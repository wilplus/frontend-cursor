import { describe, expect, it } from "vitest";

import {
  reconcileParts,
  type Part,
} from "./documentParts";
const ids = (parts: readonly Part[]) => parts.map((p) => p.id);

describe("reconcileParts keeps the id of words that did not change", () => {
  it("an untouched paragraph keeps its id", () => {
    // The document gets rewritten underneath the student by a new take or a
    // coach verify — neither goes through the arranger. Re-minting every id
    // there would discard locks on paragraphs nobody edited.
    const prev = reconcileParts("Alpha.\n\nBeta.\n\nGamma.");
    const next = reconcileParts("Alpha.\n\nBETA REWRITTEN.\n\nGamma.", prev);
    expect(next[0].id).toBe(prev[0].id);
    expect(next[2].id).toBe(prev[2].id);
  });

  it("a reorder keeps every id — the other half of §3.1", () => {
    // Reordering is named alongside rewording as what an id must survive. A
    // single monotonic pass gets only rewording: it matches C, runs off the
    // end, and re-mints A and B.
    const prev = reconcileParts("A.\n\nB.\n\nC.");
    const next = reconcileParts("C.\n\nA.\n\nB.", prev);
    expect(new Set(ids(next))).toEqual(new Set(ids(prev)));
    expect(next[0].id).toBe(prev[2].id);
    expect(next[1].id).toBe(prev[0].id);
  });
});

