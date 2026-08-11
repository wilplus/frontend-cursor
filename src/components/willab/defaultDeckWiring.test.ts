import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* -------------------------------------------------------------------------- */
/*  THE DECKLESS FENCE (founder 2026-08-11).                                   */
/*                                                                            */
/*  A speaker who uploads no presentation records against the DEFAULT deck, so */
/*  their words still bucket per slide. The failure this guards is silent and  */
/*  expensive: revert the recorder to the uploaded deck and a deckless take    */
/*  ships no slides again, its words land in one undifferentiated blob, and    */
/*  nothing can be ranked against "the same slide" in the next take — F1's     */
/*  whole premise, lost without a single test going red.                      */
/*                                                                            */
/*  A source scan because the alternative is mounting LabOverlay (a mic, a     */
/*  media recorder, a PDF renderer and a network lane) to assert one prop.     */
/*  What matters is a property of the wiring, and the wiring is three lines.   */
/* -------------------------------------------------------------------------- */

const LAB = readFileSync("src/components/willab/LabOverlay.tsx", "utf8");

describe("the deckless take records against the default deck", () => {
  it("the recorder derives its deck through deckForRecording", () => {
    expect(LAB).toMatch(/import \{[^}]*deckForRecording[^}]*\} from "@\/lib\/willab\/defaultDeck"/);
    expect(LAB).toMatch(/const recordingDeck = useMemo\(\s*\(\) => deckForRecording\(context\?\.slides\)/);
  });

  it("the UPLOAD ships the deck as presented, never the uploaded-only list", () => {
    // Scoped to the upload call: the take's slides are what make its words
    // bucketable, and sending context.slides HERE is exactly the regression.
    const call = LAB.slice(
      LAB.indexOf("await submitLabRecording({"),
      LAB.indexOf("await submitLabRecording({") + 2000
    );
    expect(call).toMatch(/slides: recordingSlides,/);
    expect(call).not.toMatch(/slides: context\.slides,/);
  });

  it("the arc CACHE still remembers the speaker's own deck, not the default they presented", () => {
    // The opposite rule to the upload, and both must hold: this cache seeds
    // the next session's setup, so recording a default deck into it would
    // tell the next take the speaker had uploaded a presentation.
    const carry = LAB.slice(LAB.indexOf("const carryArc ="), LAB.indexOf("const result = await submitLabRecording"));
    expect(carry).toMatch(/slides: context\.slides,/);
    expect(carry).not.toMatch(/recordingSlides/);
  });

  it("the slide stage and the tap timeline run off the same derived deck", () => {
    expect(LAB).toMatch(/slides=\{recordingSlides\}/);
    expect(LAB).toMatch(/const total = recordingDeck\.slides\.length;/);
    // The old deckless guard — "no deck, no taps" — must not come back: with a
    // default deck there is always something to advance.
    expect(LAB).not.toMatch(/const total = context\?\.slides\.length \?\? 0;/);
  });

  it("a default deck never claims a PDF behind it", () => {
    // presentationRef points at the uploaded file; the default deck has none,
    // and a stale ref would render someone else's pages under these words.
    expect(LAB).toMatch(/recordingDeck\.isDefault\s*\?\s*null/);
  });

  it("the founder's golden thread rides only the default deck", () => {
    expect(LAB).toMatch(/goldenThread=\{recordingDeck\.isDefault \? GOLDEN_THREAD : null\}/);
  });
});
