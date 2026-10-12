import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildRatingBody,
} from "@/services/api/stateRatings";

/* -------------------------------------------------------------------------- */
/*  THE BLIND INVARIANT, IN CODE (I1)                                          */
/*                                                                            */
/*  services/state_ratings.py stamps `saw_model_output: false` on EVERY row it */
/*  writes. It asserts the invariant rather than recording it — which is only  */
/*  safe while the surface collecting the rating genuinely shows no machine    */
/*  read. If a needle ever comes back to the labeler card, every row written   */
/*  from it carries a false blindness claim, and a corpus cannot be un-poisoned*/
/*  afterwards: an anchored label is indistinguishable from a blind one.       */
/*                                                                            */
/*  This file checks the render surface directly so a machine-derived field    */
/*  cannot slip into the blind labeler's own payload unnoticed.                */
/* -------------------------------------------------------------------------- */

const SRC = join(fileURLToPath(new URL("../../", import.meta.url)));
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const READOUT = join(
  "components",
  "willab",
  "ConfidenceEvidenceReadout.tsx",
);
const CORPUS = join("app", "coach", "corpus", "page.client.tsx");

/** Strip block + line comments so a comment EXPLAINING the fence never trips
 *  it. (Learned the hard way twice on the backend side of this batch.) */
function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("the blind labeling surface shows no machine read", () => {
  it("the readout block cannot ACCEPT a machine read at all", () => {
    // Props gone, not merely unused: an optional prop is a door back in.
    const src = code(READOUT);
    expect(src).not.toContain("acousticRead");
    expect(src).not.toContain("AcousticRead");
    expect(src).not.toContain("ReadoutFeatures");
  });

  it("the potentiometer is gone from the blind flow", () => {
    const src = code(READOUT);
    expect(src).not.toContain("Potentiometer");
    expect(src).not.toContain("potentiometer");
  });

  it("uses the same saved-answer transcript gate in the corpus", () => {
    // Since group 4 (founder 2026-09-30, B9) the corpus renders the walk's
    // one instrument, which wraps the same evidence readout; the gate is the
    // same expression, one level down.
    const corpus = code(CORPUS);
    expect(corpus).toContain("<CoachJudgeInstrument");
    expect(corpus).toContain("transcriptRevealed={piece.label !== null}");
    expect(corpus).not.toContain("{piece.transcript}</p>");
    const instrument = code(join("components", "willab", "coachwalk", "CoachJudgeInstrument.tsx"));
    expect(instrument).toContain("<ConfidenceEvidenceReadout");
    expect(instrument).toContain("transcriptRevealed={transcriptRevealed}");
  });

});

describe("buildRatingBody refuses to fabricate a label", () => {

  it("no answer and no abstention is UNBUILDABLE", () => {
    // A body that would record a verdict no human gave must be impossible to
    // construct, not merely rejected downstream.
    expect(buildRatingBody(null, false)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  THE LIFECYCLE LOCK                                                         */
/*                                                                            */
/*  The cycle is strictly                                                      */
/*    record -> analysing -> ideal text -> record -> analysing -> ideal text   */
/*                                                                            */
/*  The record button has held during analysis for a while. The DELIVERABLE    */
/*  never did, so a take could land and the student could open the ideal text  */
/*  while the next version was still being written — reading the previous      */
/*  take's words as if they were this take's, with nothing saying they were    */
/*  stale. Both halves of the cycle have to hold or the order is not enforced. */
/* -------------------------------------------------------------------------- */

