/* -------------------------------------------------------------------------- */
/*  A LOCK MUST NOT COST THE PARAGRAPH ITS SLIDE                               */
/*  (reported from real use 2026-09-18: "when I click lock the whole           */
/*   presentation drops the division into slides and concatenates into one     */
/*   text")                                                                    */
/*                                                                            */
/*  The third path to miss this rule, after #379 and #380, and the one where   */
/*  there was nothing to preserve FROM. The deck joins slides to paragraphs on */
/*  `pieces[].partId`; a never-edited document has stored no parts, so         */
/*  `reconcileParts(text, [])` minted a fresh id for every paragraph,          */
/*  seed-on-lock made the server adopt that list, and from the next read on    */
/*  not one id appeared in `piecePartIds`. Every slide join failed at once.    */
/* -------------------------------------------------------------------------- */
import { describe, expect, it } from "vitest";

import {
  partsFromCorePieces,
  reconcileParts,
} from "./documentParts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("partsFromCorePieces", () => {
  it("keeps the core's Paragraph identity", () => {
    const parts = partsFromCorePieces([
      { partId: A, text: "First slide words." },
      { partId: B, text: "Second slide words." },
    ]);
    expect(parts?.map((p) => p.id)).toEqual([A, B]);
  });

  it("carries those ids through reconciliation — the actual regression", () => {
    // What the lock does: re-derive parts from the text on screen. Seeded from
    // the core, the ids survive; seeded from nothing, every one is new and the
    // slide mapping has nothing left to join on.
    const text = "First slide words.\n\nSecond slide words.";
    const seeded = partsFromCorePieces([
      { partId: A, text: "First slide words." },
      { partId: B, text: "Second slide words." },
    ]);
    expect(reconcileParts(text, seeded ?? []).map((p) => p.id)).toEqual([A, B]);
    expect(reconcileParts(text, []).map((p) => p.id)).not.toContain(A);
  });

  it("declines rather than adopting a partial set", () => {
    // A partial adoption keeps some paragraphs' slides and silently drops
    // others, which is harder to see than losing all of them.
    expect(
      partsFromCorePieces([
        { partId: A, text: "Has identity." },
        { partId: null, text: "Has none." },
      ]),
    ).toBeNull();
  });

  it("declines a non-UUID id, which the server's seed validator refuses", () => {
    expect(
      partsFromCorePieces([{ partId: "piece-1", text: "Words." }]),
    ).toBeNull();
  });

  it("declines a repeated id — a slot collision on write", () => {
    expect(
      partsFromCorePieces([
        { partId: A, text: "One." },
        { partId: A, text: "Two." },
      ]),
    ).toBeNull();
  });

  it("declines empty or absent pieces", () => {
    expect(partsFromCorePieces([])).toBeNull();
    expect(partsFromCorePieces(null)).toBeNull();
    expect(partsFromCorePieces([{ partId: A, text: "   " }])).toBeNull();
  });
});
