import { readFileSync } from "node:fs";
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

const DECK = readFileSync(
  "src/components/willab/TranscriptReviewDeck.tsx",
  "utf8",
);

const DOC = "First paragraph words.\n\nSecond paragraph words.";
const open = (over: Partial<DeckSuggestionLite> = {}): DeckSuggestionLite => ({
  id: "s1",
  start: 0,
  end: 22,
  status: null,
  ...over,
});

describe("settled text is ordinary, never grey", () => {
  it("softens a block with an undecided judgement on it, and an untouched one", () => {
    // ONE condition for the mark (founder 2026-09-18: "the grey should be
    // when there is a mark"). Keyed on `status === "waiting"` alone, grey and
    // the bookmark could disagree and leave grey text with nothing to tap.
    // Since 2026-09-21 the untouched block shares the grey and, by design,
    // has no mark: there is nothing to tap because nothing was ever asked.
    expect(DECK).toContain("const unsettled =");
    expect(DECK).toContain('c.status === "waiting" &&');
    expect(DECK).toContain('unsettled || c.status === "untouched"');
    expect(DECK).toContain('? "text-foreground/55"');
    expect(DECK).toContain(': "text-foreground"');
  });

  it("an untouched block is grey with no mark; a reviewed one is neither", () => {
    const chunks = buildDeckChunks(DOC, null, []);
    expect(chunks.map((c) => c.status)).toEqual(["untouched", "untouched"]);
    const reviewed = buildDeckChunks(DOC, null, [open({ status: "dismissed" })]);
    expect(reviewed[0].status).toBe("clean");
    expect(reviewed[0].pendingIds).toEqual([]);
  });

  it("greys exactly where the bookmark is drawn, and nowhere else", () => {
    // 24f anchors the rewrite and the praise TO a Confident Voice item rather
    // than standing them up as their own cards, so a block cannot hold a
    // rewrite without the judgement that carries it — founder: "the rewrite
    // only happens after the judgement". Sharing the condition makes that
    // structural fact impossible to contradict on screen.
    const gate = DECK.slice(DECK.indexOf("const unsettled ="));
    expect(gate.slice(0, 200)).toContain("markWorthShowing");
    expect(DECK).toMatch(/\{unsettled \? \([\s\S]{0,80}?<DeckLockMark/);
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

describe("the two signals, and no others", () => {
  it("colours the whole block, never part of a word", () => {
    // ONE place, and it is the paragraph element. Grey applied anywhere else
    // in this file would be grey applied to something smaller than a block —
    // a span, a sentence, a word — which is what 24g-1 forbids, because a
    // colour that starts midway through a line is a gap the eye reads as
    // damage. Counting is the robust form: asserting POSITION inside JSX
    // measures how the file happens to be wrapped, not what it renders.
    const occurrences = DECK.split("text-foreground/55").length - 1;
    expect(occurrences).toBe(1);
  });

  it("adds no underline, highlight or badge to the text", () => {
    // 24g-1: "the two signals are the grey block and the bookmark, and
    // nothing else". Asserted on the paragraph's OWN class list — a window of
    // surrounding source would catch unrelated markup and say nothing.
    const classes = DECK.slice(
      DECK.indexOf("text-[clamp(1.02rem,2.5vw,1.22rem)]"),
    ).slice(0, 200);
    expect(classes).not.toContain("underline");
    expect(classes).not.toContain("bg-");
  });
});
