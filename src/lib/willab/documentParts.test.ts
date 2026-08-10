import { describe, expect, it } from "vitest";

import {
  autoLockTouched,
  insertPart,
  lockTargetAt,
  movePart,
  newPartId,
  partsForDocument,
  partsToText,
  reconcileParts,
  removePart,
  updatePart,
  type Part,
} from "./documentParts";
import { joinSegments, splitSegments } from "./documentSegments";
import { IDEAL_EDIT_COPY } from "@/components/willab/idealEditCopy";

/* -------------------------------------------------------------------------- */
/*  STABLE PARTS (SPEC-parts-locking-and-layers §3.1, Step 0)                   */
/*                                                                            */
/*  The whole feature is one property: an id survives what a position cannot.  */
/*  PR 3 hangs a lock on that id, so a churned id is a lock silently moved to  */
/*  the wrong paragraph — and afterwards indistinguishable from a right one.   */
/*                                                                            */
/*  Step 0 changes NO behaviour beyond identity, so the segment-level          */
/*  semantics are pinned here too: if any of them shifted, the arranger        */
/*  changed while claiming not to.                                            */
/* -------------------------------------------------------------------------- */

const P = (id: string, text: string): Part => ({ id, text });
const ids = (parts: readonly Part[]) => parts.map((p) => p.id);
const texts = (parts: readonly Part[]) => parts.map((p) => p.text);

describe("newPartId mints something the backend will accept", () => {
  it("is a v4 uuid", () => {
    // The BE validates the SHAPE and refuses "some string" — an id it rejects
    // fails the whole save, taking the student's words with it.
    for (let i = 0; i < 20; i += 1) {
      expect(newPartId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    }
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 500 }, newPartId));
    expect(seen.size).toBe(500);
  });
});

describe("partsToText mirrors the join both sides check against", () => {
  it("agrees with joinSegments", () => {
    // The BE refuses a payload whose parts do not join to its text. If these
    // two ever disagree, every save 400s — so they are pinned against each
    // other rather than each against a literal.
    const words = ["one", "two", "three"];
    expect(partsToText(words.map((t, i) => P(`${i}`, t)))).toBe(
      joinSegments(words)
    );
  });

  it("trims and drops blanks", () => {
    expect(partsToText([P("a", "  one  "), P("b", "   "), P("c", "two")])).toBe(
      "one\n\ntwo"
    );
  });

  it("round-trips a split document", () => {
    const doc = "First part.\n\nSecond part.\n\nThird part.";
    expect(partsToText(reconcileParts(doc))).toBe(doc);
  });
});

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

  it("reworded words are a NEW part, not the old one renamed", () => {
    // A paragraph the machine rewrote is genuinely different words. Carrying
    // the old id would silently keep a lock over text the student never
    // approved — the honest answer is that this part is new.
    const prev = reconcileParts("Alpha.\n\nBeta.");
    const next = reconcileParts("Alpha.\n\nSomething else entirely.", prev);
    expect(next[1].id).not.toBe(prev[1].id);
  });

  it("a repeated paragraph cannot steal an earlier one's id", () => {
    // The repeats are matched in reading order, never by a free search: a free
    // search would let the second "Same." take the first's id and the two
    // would swap identity for no reason. Identical words, so which copy keeps
    // which id is unobservable — but it must be STABLE.
    const prev = reconcileParts("Same.\n\nMiddle.\n\nSame.");
    const next = reconcileParts("Same.\n\nMiddle.\n\nSame.", prev);
    expect(ids(next)).toEqual(ids(prev));
    expect(next[0].id).not.toBe(next[2].id);
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

  it("a reorder AND a rewrite together", () => {
    // The realistic shape: a new take moved a paragraph and rewrote another.
    // The moved one keeps its id; the rewritten one is new.
    const prev = reconcileParts("A.\n\nB.\n\nC.");
    const next = reconcileParts("C.\n\nA.\n\nB rewritten.", prev);
    expect(next[0].id).toBe(prev[2].id);
    expect(next[1].id).toBe(prev[0].id);
    expect(ids(prev)).not.toContain(next[2].id);
  });

  it("no prior parts mints a full set", () => {
    const out = reconcileParts("One.\n\nTwo.");
    expect(texts(out)).toEqual(["One.", "Two."]);
    expect(new Set(ids(out)).size).toBe(2);
  });

  it("splits exactly where splitSegments does", () => {
    // Identity must not change WHERE a paragraph starts — that boundary is
    // shared with the piece badges, and a second opinion about it would put
    // version pills and parts on different paragraphs.
    const doc = "One.\n\n\n\nTwo.\n\nThree.";
    expect(texts(reconcileParts(doc))).toEqual(splitSegments(doc));
  });
});

describe("partsForDocument trusts the server only when it still fits", () => {
  it("uses the served ids when they join to the served text", () => {
    const served = [P("11111111-1111-4111-8111-111111111111", "One."),
                    P("22222222-2222-4222-8222-222222222222", "Two.")];
    expect(ids(partsForDocument("One.\n\nTwo.", served))).toEqual(ids(served));
  });

  it("REFUSES stale served parts and re-derives", () => {
    // Stored parts describe the document they were written against. A new take
    // or a coach verify can replace the words without touching them, and
    // honouring identity that points at words no longer on screen is the same
    // failure as re-pointing a moved tracked change (#219).
    const served = [P("11111111-1111-4111-8111-111111111111", "Old words.")];
    const out = partsForDocument("Completely new words.", served);
    expect(texts(out)).toEqual(["Completely new words."]);
    expect(out[0].id).not.toBe(served[0].id);
  });

  it("keeps ids for the paragraphs a partial rewrite left alone", () => {
    const served = [P("11111111-1111-4111-8111-111111111111", "Kept."),
                    P("22222222-2222-4222-8222-222222222222", "Gone.")];
    const out = partsForDocument("Kept.\n\nNew.", served);
    expect(out[0].id).toBe(served[0].id);
    expect(out[1].id).not.toBe(served[1].id);
  });

  it("null or empty served parts mints locally", () => {
    for (const served of [null, undefined, []]) {
      const out = partsForDocument("One.\n\nTwo.", served);
      expect(texts(out)).toEqual(["One.", "Two."]);
      expect(out.every((p) => p.id)).toBe(true);
    }
  });
});

describe("the arranger's operations carry ids through", () => {
  const base = () => [P("a", "One."), P("b", "Two."), P("c", "Three.")];

  it("a move takes the id with the words", () => {
    // THE POINT OF THE WHOLE FILE. Under the old string[] the part in slot 0
    // was simply "whatever is in slot 0" afterwards.
    const out = movePart(base(), 0, 2);
    expect(texts(out)).toEqual(["Two.", "Three.", "One."]);
    expect(ids(out)).toEqual(["b", "c", "a"]);
  });

  it("a no-op or out-of-range move returns the SAME array", () => {
    // The host compares by identity to decide whether the document is dirty.
    const parts = base();
    expect(movePart(parts, 1, 1)).toBe(parts);
    expect(movePart(parts, 9, 0)).toBe(parts);
    expect(movePart(parts, -1, 0)).toBe(parts);
  });

  it("a move past the end clamps rather than dropping the part", () => {
    expect(texts(movePart(base(), 0, 99))).toEqual(["Two.", "Three.", "One."]);
  });

  it("an insert mints exactly one new id and disturbs no other", () => {
    const parts = base();
    const out = insertPart(parts, 1, " Added. ");
    expect(texts(out)).toEqual(["One.", "Added.", "Two.", "Three."]);
    expect([out[0].id, out[2].id, out[3].id]).toEqual(["a", "b", "c"]);
    expect(out[1].id).not.toBe("");
  });

  it("an insert of nothing is not an edit", () => {
    const parts = base();
    expect(insertPart(parts, 1, "   ")).toBe(parts);
  });

  it("a REWORD keeps the id", () => {
    // The second thing a position cannot survive. Locked text is exactly the
    // text that keeps being restyled, so a reword must not mint a new part.
    const out = updatePart(base(), 1, "Two, but better.");
    expect(out[1]).toEqual(P("b", "Two, but better."));
  });

  it("an unchanged reword returns the SAME array", () => {
    const parts = base();
    expect(updatePart(parts, 1, "Two.")).toBe(parts);
  });

  it("clearing a part removes it", () => {
    expect(ids(updatePart(base(), 1, "  "))).toEqual(["a", "c"]);
  });

  it("a removal drops that id and no other", () => {
    expect(ids(removePart(base(), 1))).toEqual(["a", "c"]);
    const parts = base();
    expect(removePart(parts, 9)).toBe(parts);
  });
});

describe("autoLockTouched — typed = committed (founder 2026-08-10)", () => {
  const served = (
    ...specs: Array<[string, string, boolean?]>
  ): Part[] => specs.map(([id, text, locked]) => ({ id, text, locked }));

  it("a typed reword locks its part", () => {
    // reconcileParts mints a NEW id for changed words, so a reworded part
    // shows up as absent from the baseline → touched → locked.
    const base = served(["a", "Original."], ["b", "Untouched."]);
    const next = reconcileParts("Reworded by hand.\n\nUntouched.", base);
    const out = autoLockTouched(next, base);
    expect(out[0].locked).toBe(true);
    expect(out[1].locked).toBe(false);
  });

  it("a brand-new typed paragraph locks", () => {
    const base = served(["a", "One."]);
    const out = autoLockTouched(
      reconcileParts("One.\n\nAdded by hand.", base),
      base
    );
    expect(out.map((p) => p.locked)).toEqual([false, true]);
  });

  it("a pure MOVE does not lock — arrangement is not authorship", () => {
    const base = served(["a", "One."], ["b", "Two."]);
    const out = autoLockTouched(reconcileParts("Two.\n\nOne.", base), base);
    expect(out.every((p) => p.locked === false)).toBe(true);
  });

  it("an existing lock is never dropped", () => {
    // Mirrors the server rule: the save path only ADDS locks; removal is
    // the R5-gated endpoint's job alone.
    const base = served(["a", "Pinned.", true], ["b", "Open."]);
    const out = autoLockTouched(
      reconcileParts("Pinned.\n\nOpen.", base),
      base
    );
    expect(out[0].locked).toBe(true);
  });

  it("no baseline locks everything — a first save is all authorship", () => {
    const out = autoLockTouched(reconcileParts("One.\n\nTwo."), null);
    expect(out.every((p) => p.locked === true)).toBe(true);
  });
});

describe("lockTargetAt — the Accept→'Lock it' resolution (SPEC-lockin-loop §2)", () => {
  const parts: Part[] = [
    { id: "a", text: "First paragraph." },
    { id: "b", text: "Second paragraph.", locked: true },
  ];

  it("resolves the part at the paragraph index when the words agree", () => {
    expect(lockTargetAt(parts, 0, "First paragraph.")).toBe(parts[0]);
    expect(lockTargetAt(parts, 1, "Second paragraph.")).toBe(parts[1]);
  });

  it("whitespace differences do not break the claim (both sides trim)", () => {
    expect(lockTargetAt(parts, 0, "  First paragraph.\n")).toBe(parts[0]);
  });

  it("REFUSES a words mismatch rather than guessing", () => {
    // The one state worth never producing: a lock settled on a paragraph
    // the student was not looking at. Same never-guess-an-anchor rule as
    // every tracked change.
    expect(lockTargetAt(parts, 0, "Second paragraph.")).toBeNull();
  });

  it("refuses an out-of-range index", () => {
    expect(lockTargetAt(parts, -1, "First paragraph.")).toBeNull();
    expect(lockTargetAt(parts, 2, "First paragraph.")).toBeNull();
    expect(lockTargetAt([], 0, "First paragraph.")).toBeNull();
  });
});

describe("the superseded-edit card is gone (founder option A)", () => {
  it("its copy keys no longer exist", () => {
    // With per-part persistence the typed paragraphs arrive pinned inside
    // the refetched document — there is nothing to hold and offer back. A
    // key left behind is an invitation to re-render the card.
    const copy = IDEAL_EDIT_COPY as Record<string, unknown>;
    for (const key of [
      "supersededTitle",
      "supersededBody",
      "supersededReapply",
      "supersededDismiss",
    ]) {
      expect(copy, key).not.toHaveProperty(key);
    }
  });
});

describe("identity survives a realistic session", () => {
  it("add, move, reword, reload — the untouched parts keep their ids", () => {
    let parts = reconcileParts("Hook.\n\nBody.\n\nClose.");
    const [hook, body, close] = ids(parts);

    parts = insertPart(parts, 1, "New bridge.");
    parts = movePart(parts, 3, 0);
    parts = updatePart(parts, 1, "Hook, sharpened.");

    // A reload: the server hands back what was saved.
    const served = parts.map((p) => ({ ...p }));
    const reloaded = partsForDocument(partsToText(parts), served);

    expect(ids(reloaded)).toEqual(ids(parts));
    expect(reloaded[0].id).toBe(close);
    expect(reloaded[1].id).toBe(hook);       // reworded, same part
    expect(reloaded[3].id).toBe(body);
    expect(ids(reloaded)).toContain(hook);
  });
});
