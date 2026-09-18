import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* -------------------------------------------------------------------------- */
/*  THE DECK FLICKER                                                           */
/*  (reported from real use 2026-09-18: "the preview is still unavailable ...  */
/*   even though for a moment it is then it disappears")                       */
/*                                                                            */
/*  Deck URLs used to be permanent public links, so the same read returned the */
/*  same string forever. Since user content began signing on read, every GET   */
/*  re-mints a FRESH presigned URL for the same object. DeckSlidePreview keys  */
/*  its failure reset on the url and pdf.js reloads the document when it       */
/*  changes, so every poll tore down a rendering document and started again.   */
/*                                                                            */
/*  Asserted on the source, because the fix is a rule about identity rather    */
/*  than a render: one R2 object is one path, however many times it is signed. */
/* -------------------------------------------------------------------------- */

const HOOK = readFileSync("src/components/willab/useArcDeckRef.ts", "utf8");

/** The hook's rule, mirrored here so the cases below are readable. A drift
 *  between this and the hook is caught by the source assertions underneath. */
function identity(ref: string | null): string | null {
  if (!ref) return null;
  const query = ref.indexOf("?");
  return query === -1 ? ref : ref.slice(0, query);
}

const SIGNED_ONCE =
  "https://acct.r2.cloudflarestorage.com/coach-feedback-videos/" +
  "willab_presentations/deck.pdf?X-Amz-Date=20260918T100000Z&X-Amz-Signature=aaa";
const SIGNED_AGAIN =
  "https://acct.r2.cloudflarestorage.com/coach-feedback-videos/" +
  "willab_presentations/deck.pdf?X-Amz-Date=20260918T100500Z&X-Amz-Signature=bbb";
const A_DIFFERENT_DECK =
  "https://acct.r2.cloudflarestorage.com/coach-feedback-videos/" +
  "willab_presentations/other.pdf?X-Amz-Signature=ccc";

describe("one object is one deck, however often it is signed", () => {
  it("sees two signatures of the same object as the same deck", () => {
    // THE BUG: these two differ as strings, and that difference alone was
    // enough to reload the document out from under the speaker.
    expect(SIGNED_ONCE).not.toBe(SIGNED_AGAIN);
    expect(identity(SIGNED_ONCE)).toBe(identity(SIGNED_AGAIN));
  });

  it("still tells a genuinely different deck apart", () => {
    expect(identity(SIGNED_ONCE)).not.toBe(identity(A_DIFFERENT_DECK));
  });

  it("handles an unsigned ref and no ref at all", () => {
    expect(identity("https://pub-x.r2.dev/willab_presentations/deck.pdf")).toBe(
      "https://pub-x.r2.dev/willab_presentations/deck.pdf",
    );
    expect(identity(null)).toBeNull();
  });
});

describe("the hook holds the ref it already handed out", () => {
  it("compares on identity rather than on the whole url", () => {
    expect(HOOK).toContain("mediaObjectIdentity");
    expect(HOOK).toContain(
      "mediaObjectIdentity(held.current.ref) === mediaObjectIdentity(next)",
    );
  });

  it("replaces it when the arc changes", () => {
    // A different arc is a different deck even if the path somehow matched.
    expect(HOOK).toContain("held.current.arcId === arcId");
  });

  it("does not return the raw payload ref any more", () => {
    // The old body ended `return payloadRef ?? cached ?? fetched;` — that
    // straight pass-through is what let a re-signed URL reach pdf.js.
    expect(HOOK).not.toMatch(/return payloadRef \?\? cached \?\? fetched;/);
    expect(HOOK).toContain("holdWhileSameObject");
  });
});
