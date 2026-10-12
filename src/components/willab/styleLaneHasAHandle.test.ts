import { describe, expect, it } from "vitest";
import { buildDeckChunks, styleFor } from "@/lib/willab/deckChunks";

/* -------------------------------------------------------------------------- */
/*  THE STYLE LANE'S HANDLE (founder 2026-08-12)                               */
/*                                                                            */
/*  The post-lock style lane came back the same day it was un-parked, and it   */
/*  landed in exactly the state the coach note was in before the dot: the      */
/*  proposal lives ONLY inside the chunk's modal (the page never re-marks      */
/*  locked text), every mark is clickable, and nothing told the student WHICH  */
/*  locked chunk was worth re-opening. A door with no handle.                  */
/*                                                                            */
/*  The founder's ruling: an amber pulse on the LOCKED pill. "It keeps the     */
/*  surface clean, invents no new glyphs, and intuitively says 'locked, but a  */
/*  finishing touch is inside.'"                                              */
/*                                                                            */
/*  What this file guards is the SHAPE of that ruling, because every part of   */
/*  it is the kind of thing a later change erodes one defensible step at a     */
/*  time — a fourth status "just for style", a new icon "so it reads", a new   */
/*  sentence "so it's clear", the amber creeping onto an unlocked chunk.       */
/* -------------------------------------------------------------------------- */

/* ------------------------------ the join itself ---------------------------- */

const DOC = "First chunk here.\n\nSecond chunk here.\n\nThird chunk here.";

function chunks() {
  return buildDeckChunks(DOC, null, []);
}

function style(
  start: number,
  end: number,
  status: "pending" | "approved" | "dismissed" | null = "pending"
) {
  return { id: `s${start}`, start, end, status };
}

describe("styleFor — which chunk a style proposal belongs to", () => {
  it("returns the proposal whose span overlaps the chunk", () => {
    const [c0, c1, c2] = chunks();
    const s = style(c1.start + 2, c1.start + 8);
    expect(styleFor([s], c1)?.id).toBe(s.id);
    expect(styleFor([s], c0)).toBeNull();
    expect(styleFor([s], c2)).toBeNull();
  });

  it("a DECIDED proposal is history and lights nothing", () => {
    const [, c1] = chunks();
    const at = [c1.start + 2, c1.start + 8] as const;
    expect(styleFor([style(...at, "approved")], c1)).toBeNull();
    expect(styleFor([style(...at, "dismissed")], c1)).toBeNull();
    // null = UNDECIDED (R4) — absence of a decision is pending, the same
    // ground truth the BE's ledger follows. Coercing it would hide the lane.
    expect(styleFor([style(...at, null)], c1)).not.toBeNull();
  });

  it("nothing to show is null, never a throw", () => {
    const [c0] = chunks();
    expect(styleFor(null, c0)).toBeNull();
    expect(styleFor(undefined, c0)).toBeNull();
    expect(styleFor([], c0)).toBeNull();
  });

  it("a proposal that touches a boundary belongs to ONE chunk", () => {
    // Half-open on both sides: the mark must not light up two pills for one
    // proposal, which is what an inclusive comparison would do.
    const [c0, c1] = chunks();
    const s = style(c1.start, c1.start + 5);
    expect(styleFor([s], c0)).toBeNull();
    expect(styleFor([s], c1)?.id).toBe(s.id);
  });
});
