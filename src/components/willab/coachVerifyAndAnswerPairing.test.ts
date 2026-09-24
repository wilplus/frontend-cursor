import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* -------------------------------------------------------------------------- */
/*  TWO FOUNDER SIGN-OFFS ON THE COACH SURFACE, 2026-09-24.                    */
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
/*  (2) VERIFY IS NOT A DEAD END. Approving the ideal text swapped the button  */
/*      for a badge and left nothing to press, so the coach had to work out    */
/*      for themselves that the ✕ was the way on. Worse, the line under it     */
/*      named the wrong screen: publishing lives on "Review and send", two     */
/*      screens past Wrap up, so a coach following the sentence went looking   */
/*      for a button that was not there.                                       */
/*                                                                            */
/*  Both are read off the source rather than rendered, because both are        */
/*  STRUCTURAL rulings — where a node sits relative to another, and which      */
/*  screen a sentence names. A render test would pass just as happily with the */
/*  line back at the top of the card.                                          */
/* -------------------------------------------------------------------------- */

const SRC = join(fileURLToPath(new URL("../../", import.meta.url)));
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const CARD = read(join("components", "willab", "CoachSnippetReviewCard.tsx"));
const PANEL = read(join("components", "willab", "CoachIdealTextPanel.tsx"));
const OVERLAY = read(
  join("components", "willab", "BestPresentationOverlay.tsx"),
);

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

describe("verify hands the coach onward", () => {
  it("names the screen that actually publishes", () => {
    expect(PANEL).toContain("Review and send");
    // The old sentence sent them to Wrap up to look for a button that lives
    // two screens further on.
    expect(PANEL).not.toContain("from the wrap-up screen");
  });

  it("offers a control once approved, wired to leaving the panel", () => {
    const approved = PANEL.indexOf("{approved ? (");
    const control = PANEL.indexOf("onClick={onDone}");
    expect(approved).toBeGreaterThan(-1);
    expect(control).toBeGreaterThan(approved);
    expect(PANEL).toContain("Back to Wrap up");
  });

  it("degrades to nothing when there is no way back", () => {
    // A deep link with no delivery overlay underneath must not offer a button
    // that goes nowhere — the control is guarded, not assumed.
    expect(PANEL).toContain("{onDone ? (");
  });

  it("the overlay gives the panel the same exit as its ✕", () => {
    // Closing this overlay reveals the delivery flow it was opened from, whose
    // Wrap up button then reads "Ideal text · approved". That is the whole
    // hand-off; the panel needs no navigation of its own.
    expect(OVERLAY).toContain("onDone={onClose}");
  });
});
