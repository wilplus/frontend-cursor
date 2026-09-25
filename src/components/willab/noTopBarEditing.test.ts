import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* -------------------------------------------------------------------------- */
/*  THE TOP BAR HOLDS NO EDIT (founder 2026-08-11, verbatim: "The edits should  */
/*  not be in the top bar" — sent with a screenshot of two pencils circled).    */
/*                                                                            */
/*  Editing is a CHUNK act: you click the chunk's lock and change the words in  */
/*  the modal that opens, in front of the text you are changing. A pencil in    */
/*  the header opens a WHOLE-DOCUMENT mode instead — a second edit lane over    */
/*  the same document, with its own save path and its own idea of identity.     */
/*  That is what this fence is really about: not the glyph, the second lane.    */
/*                                                                            */
/*  A source scan, deliberately: the pencils were TWO buttons in one host and   */
/*  one in the other, each gating a different editor, and a render test only    */
/*  covers the surface it mounts. What must hold is a property of the code —    */
/*  neither ideal-text host draws an edit affordance in its header, and neither */
/*  mounts a whole-document editor at all.                                     */
/* -------------------------------------------------------------------------- */

const HOSTS = [
  "src/components/willab/IdealTextOverlay.tsx",
  "src/components/willab/IdealTextReadout.tsx",
];

/** The pencil, in the two shapes it can reach a screen: a JSX element, or a
 *  lucide import specifier. `PencilLine` is the one this product draws; the
 *  bare `Pencil` and `SquarePen` are the obvious substitutes. */
function drawsAPencil(source: string): boolean {
  if (/<(PencilLine|Pencil|SquarePen)[\s/>]/.test(source)) return true;
  const lucide = source.match(/import\s*\{([^}]*)\}\s*from\s*"lucide-react"/);
  return lucide ? /\b(PencilLine|Pencil|SquarePen)\b/.test(lucide[1]) : false;
}

describe("no editing in the ideal-text top bar (founder 2026-08-11)", () => {
  it("neither ideal-text host draws an edit pencil", () => {
    const offenders = HOSTS.filter((f) => drawsAPencil(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("neither host mounts a whole-document editor — no second edit lane", () => {
    // ChunkedEditor and the overlay's own NotebookEditor were the two modes
    // the pencils opened. Mounting either again re-creates the lane, pencil
    // or no pencil.
    for (const f of HOSTS) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/<ChunkedEditor/);
      expect(src).not.toMatch(/<MarkedEditor/);
      expect(src).not.toMatch(/<NotebookEditor/);
    }
  });

  it("no host keeps an `editing` mode to route around the chunk modal", () => {
    // The state is the lane. While a host holds an "am I editing the whole
    // document" flag, something can flip it — a keyboard shortcut, a gesture,
    // the next feature — and the second lane is back without a pencil.
    for (const f of HOSTS) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/useState.*\n?.*\[\s*(editing|chunkEditing)\s*,/);
      expect(src).not.toMatch(/const \[(editing|chunkEditing),/);
    }
  });

  it("editing still has a way in — the slide's own editor — so it did not just vanish", () => {
    // The counterweight to the three assertions above: removing the pencils
    // must not read as "editing was removed". Since 2026-09-25 (Q24 B) there
    // is no Lock screen in the sheet, so the way in is the slide editor; the
    // sheet keeps its marker-aware field only as the ladder's fallback.
    const modal = readFileSync(
      "src/components/willab/DeckChunkModal.tsx",
      "utf8"
    );
    expect(modal).toMatch(/<MarkedEditor/);
    expect(
      readFileSync("src/components/willab/TranscriptReviewDeck.tsx", "utf8"),
    ).toMatch(/onClick=\{\(\) => setEditingSlideIndex\(g\.slideIndex\)\}/);
    // And it is the MARKER-AWARE field, never a raw one: a textarea over the
    // marker source prints "**bold**" at the student, which FE-1 forbids —
    // and this modal is the only way into the text.
    expect(modal).not.toMatch(/<textarea/);
    // No toolbar: its Underline button would let a student underline their
    // own words, and on the deck underline means "feedback is waiting here".
    expect(modal).toMatch(/toolbar=\{false\}/);
    // Feedback uses the bookmark; slide editing has its own explicit control.
    const deck = readFileSync(
      "src/components/willab/TranscriptReviewDeck.tsx",
      "utf8"
    );
    const usage = deck.match(/<DeckLockMark[\s\S]*?\/>/);
    expect(usage).not.toBeNull();
    expect(usage?.[0]).not.toMatch(/disabled/);
    expect(usage?.[0]).toMatch(/onClick=\{\(\) => \{/);
    // Since 2026-09-25 the bookmark joins the Back / Next walk at this
    // paragraph (a coach moment opens its coaching sheet from there).
    expect(usage?.[0]).toMatch(/walk\.openPart\(c\.part\.id\)/);
    // Opens the chunk sheet on THAT chunk. It goes through `openParagraph`
    // since 2026-09-16 rather than setting a bare id: the sheet is remembered
    // by id AND position + words, so a refetch that re-mints identities cannot
    // unmount it under the speaker (see deckSheetSurvival.test.tsx). The rule
    // asserted here is unchanged — the bookmark opens this chunk's sheet.
    expect(usage?.[0]).toMatch(/openParagraph\(c\)/);
    expect(deck).toContain("Edit the text");
  });
});
