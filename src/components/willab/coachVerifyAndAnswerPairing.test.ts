import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* -------------------------------------------------------------------------- */
/*  FOUNDER SIGN-OFF ON THE COACH SURFACE, 2026-09-24.                         */
/*                                                                            */
/*  (1) THE TWO ANSWERS SIT TOGETHER. The speaker's own answer to the same     */
/*      question used to render above the bookmark pill and above the audio —  */
/*      mid-card, a screen's length from the chips the coach had just tapped,  */
/*      so reading one against the other took two looks. It now renders        */
/*      directly under the coach's own instrument. This is placement only: the */
/*      server still withholds the value until the coach commits, and the line */
/*      is still labelled as the SPEAKER's rather than merged into the coach's */
/*      row (L3 keeps the two lanes apart).                                    */
/*                                                                            */
/*  (2) was the verify hand-off, retired with the coach's approve on           */
/*      2026-09-30 (founder B2).                                               */
/*                                                                            */
/*  Read off the source rather than rendered, because it is a STRUCTURAL       */
/*  ruling — where a node sits relative to another. A render test would pass   */
/*  just as happily with the line back at the top of the card.                 */
/* -------------------------------------------------------------------------- */

const SRC = join(fileURLToPath(new URL("../../", import.meta.url)));
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const CARD = read(join("components", "willab", "CoachSnippetReviewCard.tsx"));

describe("the speaker's answer sits under the coach's own", () => {
  it("renders after the instrument, not before the evidence", () => {
    const instrument = CARD.indexOf("{instrument}");
    const said = CARD.indexOf("The speaker said:");
    const readout = CARD.indexOf("<ConfidenceEvidenceReadout");

    expect(instrument).toBeGreaterThan(-1);
    expect(said).toBeGreaterThan(-1);
    expect(readout).toBeGreaterThan(-1);

    // The whole point of the move: the two answers are adjacent.
    expect(said).toBeGreaterThan(instrument);
    // And the old position — above the audio — is genuinely vacated.
    expect(said).toBeGreaterThan(readout);
  });

  it("is still withheld until the coach has answered", () => {
    // The guard IS the gate on this surface: the server sends an empty string
    // until the coach commits, so rendering it at all is proof they answered.
    // Dropping the guard would print a bare "The speaker said:" on every
    // unanswered moment — and dropping the server's rule would leak the
    // speaker's answer into a blind judgement.
    expect(CARD).toContain("{snippet.ownerAnswer ? (");
  });

  it("is still labelled as the speaker's, not merged into the coach's row", () => {
    // L3. Two named answers side by side is the readable form of the
    // provenance wall; one unlabelled row holding either would be a breach.
    expect(CARD).toContain("The speaker said:");
    expect(CARD).toContain("OWNER_ANSWER_LABELS[snippet.ownerAnswer]");
  });
});
