import { describe, expect, it } from "vitest";
import { createLineTurns, linesOf, type WalkBankKey } from "./walkLines";
import type { WalkStep } from "./walkPlan";

/* The walk's signed lines, never twice in a row (D-FW-3; backend 0438). */

/** The backend's banks and their sizes (services/line_bank.py BANKS): the
 *  server's index means the same line here only while these match. */
const BACKEND_SIZES: Record<WalkBankKey, number> = {
  B01: 5, B02: 4, B03: 4, B04: 4, B05: 5, B06: 5, B07: 5, B08: 5, B09: 5,
  B10: 5, B11: 7, B12: 5, B13: 7, B14: 7, NX3a: 4, CM3b: 4,
};

const clearer = (moment: number): WalkStep => ({ key: "clearer", moment, slide: 0 });

describe("the signed banks", () => {
  it("are the backend's banks, line for line in number", () => {
    for (const [bank, size] of Object.entries(BACKEND_SIZES)) {
      expect(linesOf(bank as WalkBankKey), bank).toHaveLength(size);
    }
  });
});

describe("createLineTurns", () => {
  it("follows the memory as read, unless this opening already said a line of that bank", () => {
    const turns = createLineTurns();
    turns.adopt({ B13: 5, B14: 2 });
    expect(turns.say(clearer(0), "B13")).toBe(linesOf("B13")[5]);
    // A late read that predates the record must not hand the line back.
    turns.adopt({ B13: 5, B14: 3 });
    expect(turns.say(clearer(1), "B13")).toBe(linesOf("B13")[6]);
    expect(turns.say(clearer(1), "B14")).toBe(linesOf("B14")[3]);
    turns.adopt({ B13: -1, B14: 1.5 } as Record<string, number>);
    turns.reopen();
    expect(turns.say(clearer(2), "B13")).toBe(linesOf("B13")[0]);
  });
});
