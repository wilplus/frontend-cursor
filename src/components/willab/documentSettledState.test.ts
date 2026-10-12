import { describe, expect, it } from "vitest";
import { buildDeckChunks, type DeckSuggestionLite } from "@/lib/willab/deckChunks";

/* -------------------------------------------------------------------------- */
/*  DOCUMENT STATE — contract 24g-1                                            */
/*  (founder 2026-09-18: "Change the locked in as the grey text to black       */
/*   text ... you should have [inferred it]")                                  */
/*                                                                            */
/*  "A block holding an unsettled judgement renders in a softened grey; a      */
/*  settled block renders in the ordinary text colour with no mark at all."    */
/*                                                                            */
/*  The clean text IS the settled state, and the document empties as the       */
/*  speaker works rather than accumulating marks.                              */
/*                                                                            */
/*  AND ONE STATE BEFORE ALL OF THAT (founder 2026-09-21): a block nobody has  */
/*  ever worked on — no bookmark answered, no rooting phrase, no lock cycle —  */
/*  is UNTOUCHED: the same softened grey, and NO mark. So grey now means one   */
/*  of two things, "waiting" (a bookmark is drawn) or "untouched" (nothing     */
/*  is), and reviewed text is never grey. The page reads as the paragraph's    */
/*  own history: grey → bookmark → full text → lock with its orange phrase.    */
/* -------------------------------------------------------------------------- */

const DOC = "First paragraph words.\n\nSecond paragraph words.";
const open = (over: Partial<DeckSuggestionLite> = {}): DeckSuggestionLite => ({
  id: "s1",
  start: 0,
  end: 22,
  status: null,
  ...over,
});

describe("settled text is ordinary, never grey", () => {

  it("an untouched block is grey with no mark; a reviewed one is neither", () => {
    const chunks = buildDeckChunks(DOC, null, []);
    expect(chunks.map((c) => c.status)).toEqual(["untouched", "untouched"]);
    const reviewed = buildDeckChunks(DOC, null, [open({ status: "dismissed" })]);
    expect(reviewed[0].status).toBe("clean");
    expect(reviewed[0].pendingIds).toEqual([]);
  });

  it("marks a locked block settled", () => {
    // A LOCKED paragraph is a decision the speaker has made. It is finished
    // work and reads as ordinary text — greying it would say the opposite.
    const [chunk] = buildDeckChunks(DOC, [
      { id: "p1", text: "First paragraph words.", locked: true },
      { id: "p2", text: "Second paragraph words." },
    ], []);
    expect(chunk.status).toBe("locked");
    expect(chunk.status === "waiting").toBe(false);
  });

  it("marks a reviewed block settled too, and an untouched one is not waiting either", () => {
    const [reviewed] = buildDeckChunks(DOC, null, [open({ status: "dismissed" })]);
    expect(reviewed.status).toBe("clean");
    const [bare] = buildDeckChunks(DOC, null, []);
    expect(bare.status).toBe("untouched");
    expect(bare.status === "waiting").toBe(false);
  });

  it("softens a block while something is still undecided on it", () => {
    const [chunk] = buildDeckChunks(DOC, null, [open()]);
    expect(chunk.status).toBe("waiting");
  });

  it("settles again once the judgement is answered", () => {
    // Approved and dismissed are both decisions, so both settle the block.
    for (const status of ["approved", "dismissed"] as const) {
      const [chunk] = buildDeckChunks(DOC, null, [open({ status })]);
      expect(chunk.status, status).not.toBe("waiting");
    }
  });
});

