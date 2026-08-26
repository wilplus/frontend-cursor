import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* -------------------------------------------------------------------------- */
/*  THE LOCK-AFTER-EDIT BUG (founder 2026-08-15)                               */
/*                                                                            */
/*  "also when I have edited the text after the styling and I am trying to     */
/*  lock it in, it doesnt lock in."                                           */
/*                                                                            */
/*  ROOT CAUSE, from the source rather than from a hunch. `textRef` was        */
/*  written in exactly ONE place — the render body — while `applyEdit` set the */
/*  `text` STATE and updated `partsRef` synchronously beside it. React does    */
/*  not re-render inside a callback, so for the rest of that tick the two refs */
/*  disagreed: parts described the edited document, text still described the   */
/*  old one.                                                                  */
/*                                                                            */
/*  `deckLockPart` calls `applyEdit` and then `flushEdits` on the very next    */
/*  line, and every save site reads `textRef`. So:                            */
/*                                                                            */
/*    • flushEdits's fast path compares savedTextRef to textRef, and on a      */
/*      freshly served document those are the SAME string (the SD adopt sets   */
/*      both together). The guard read "already saved", returned true without  */
/*      sending anything, and deckLockPart reported "ok";                     */
/*    • deckLockPart then cleared the dirty flag — the only thing keeping the  */
/*      800ms debounce alive — and refetched, so the server's text came back   */
/*      over the student's words;                                             */
/*    • the explicit lock that follows the save could only target stale words.*/
/*                                                                            */
/*  The chunk came back unlocked, wearing its old words. Styling did not cause */
/*  it — applyStyle nulls savedTextRef and refetches, so a lock landing before */
/*  that refetch took the OTHER branch and PUT the stale pre-edit document,    */
/*  reporting success over words the student never wrote. One root, two ways   */
/*  to lose the edit.                                                         */
/*                                                                            */
/*  Pinned at source level because this repo renders nothing in tests: the     */
/*  defect is an ordering relationship between a ref and a setState, which no  */
/*  pure function exposes. What CAN be pinned is that the ref moves with the   */
/*  state, which is the whole fix.                                            */
/* -------------------------------------------------------------------------- */

/** Source with COMMENTS STRIPPED — the block above and the one in the
 *  component both quote the broken shape at length, so scanning raw text
 *  would match the record of the bug instead of the bug. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const READOUT = code("src/components/willab/IdealTextReadout.tsx");
const OVERLAY = code("src/components/willab/IdealTextOverlay.tsx");

/** The body of a top-level `const <name> = useCallback((…) => { … })`. */
function callbackBody(src: string, name: string): string {
  const start = src.indexOf(`const ${name} = useCallback(`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const open = src.indexOf("{", src.indexOf("=>", start));
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`${name} body never closed`);
}

describe("the edit lane's text ref moves with its state", () => {
  it("applyEdit updates textRef.current, not only the text state", () => {
    // THE FIX. Without this line the save lane spends the rest of the tick
    // describing a document the student has already left.
    const body = callbackBody(READOUT, "applyEdit");
    expect(body).toMatch(/textRef\.current\s*=\s*next/);
  });

  it("applyEdit updates BOTH refs, so parts and text can never disagree", () => {
    // partsRef was always synchronous here. The asymmetry was the defect, so
    // the pin is on the pair — a future edit that drops one of them
    // reintroduces exactly this bug.
    const body = callbackBody(READOUT, "applyEdit");
    expect(body).toMatch(/partsRef\.current\s*=\s*parts/);
    expect(body).toMatch(/setText\(next\)/);
  });

  it("the deck lock still commits through the one save lane, then locks", () => {
    // The shape that has to survive: edit the part, push it into the lane,
    // and REFUSE the lock if the PUT did not land. A lock reported over an
    // unsaved document is the failure this whole file is about.
    const body = callbackBody(READOUT, "deckLockPart");
    expect(body).toMatch(/applyEdit\(/);
    expect(body).toMatch(/await flushEdits\(\)/);
    expect(body).toMatch(
      /if \(!ok\) return \{ outcome: "failed", rootPhraseProposal: null \}/
    );
    expect(body).toMatch(/await setPartLock\(/);
    // applyEdit must come FIRST — flushing before the edit exists would send
    // the old document just as surely as a stale ref did.
    expect(body.indexOf("applyEdit(")).toBeLessThan(
      body.indexOf("await flushEdits()"),
    );
  });

  it("flushEdits still refuses to claim a save it cannot confirm", () => {
    // The guard is only safe once the ref is honest; it is load-bearing and
    // must not be softened into an unconditional true.
    const body = callbackBody(READOUT, "flushEdits");
    expect(body).toMatch(/savedTextRef\.current === textRef\.current/);
    expect(body).toMatch(/return savedTextRef\.current === textRef\.current/);
  });

  it("the OTHER host passes its text explicitly and never through a ref", () => {
    // IdealTextOverlay (the chat/library door) hands the composed document
    // straight to saveDocument, which is why it never had this bug. Pinned so
    // a later "tidy-up" does not route it through a ref for symmetry.
    const body = callbackBody(OVERLAY, "deckLockPart");
    expect(body).toMatch(/const nextText = partsToText\(next\)/);
    expect(body).toMatch(/saveDocument\(nextText, next\)/);
    expect(body).not.toMatch(/textRef/);
  });
});
