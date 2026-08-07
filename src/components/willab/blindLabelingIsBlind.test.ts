import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildRatingBody,
  CONFIDENCE_STATE_ID,
  TERNARY_VALUES,
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
/*  The existing starVerdictSeparation test fences the labeler flow from       */
/*  IMPORTING the star-verdict lane. It could not catch this one, because      */
/*  `acousticRead` arrived on the labeler's OWN payload through coachReview.ts */
/*  and walked straight past an import fence. So this file checks the render   */
/*  surface instead.                                                           */
/* -------------------------------------------------------------------------- */

const SRC = join(fileURLToPath(new URL("../../", import.meta.url)));
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const CARD = join("components", "willab", "CoachSnippetReviewCard.tsx");
const READOUT = join("components", "willab", "SnippetReadoutBlock.tsx");

/** Strip block + line comments so a comment EXPLAINING the fence never trips
 *  it. (Learned the hard way twice on the backend side of this batch.) */
function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("the blind labeling surface shows no machine read", () => {
  it("the labeler card never passes an acoustic read down", () => {
    expect(code(CARD)).not.toMatch(/acousticRead|features=\{/);
  });

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

  it("the labeler card renders the question it is asking", () => {
    // Without the question on screen the fixed answer space is unanchored:
    // "Yes" to what? The state carries the question, never the answer labels.
    expect(code(CARD)).toContain("CONFIDENCE_QUESTION");
  });
});

describe("the F2 direction construct is purged from the FE", () => {
  const FILES = [
    CARD,
    READOUT,
    join("components", "willab", "CoachReviewOverlay.tsx"),
    join("services", "api", "coachReview.ts"),
    join("services", "api", "publishWillabSession.ts"),
  ];

  it("no file in the labeling flow still speaks of directions", () => {
    for (const rel of FILES) {
      const src = code(rel);
      expect(src, rel).not.toContain("directionLabel");
      expect(src, rel).not.toContain("DirectionLabel");
      expect(src, rel).not.toContain("direction_label");
    }
  });

  it("challenge / threat appear nowhere in the labeling flow", () => {
    for (const rel of FILES) {
      const src = code(rel);
      expect(src, rel).not.toMatch(/"challenge"|"threat"/);
    }
  });
});

describe("buildRatingBody refuses to fabricate a label", () => {
  it("builds a plain ternary answer", () => {
    expect(buildRatingBody("yes", false)).toEqual({
      state_id: CONFIDENCE_STATE_ID,
      value: "yes",
    });
  });

  it("accepts every value in the fixed answer space", () => {
    for (const v of TERNARY_VALUES) {
      expect(buildRatingBody(v, false)).toMatchObject({ value: v });
    }
  });

  it("an abstention carries NO value", () => {
    // The backend rejects a body with both; more importantly, `unrateable` is
    // a judgment about the RATER and `neutral` one about the MOMENT. Folding
    // them together books bad audio as a real middling rating.
    const body = buildRatingBody(null, true);
    expect(body).toEqual({ state_id: CONFIDENCE_STATE_ID, unrateable: true });
    expect(body).not.toHaveProperty("value");
  });

  it("an abstention drops any value handed to it", () => {
    expect(buildRatingBody("yes", true)).not.toHaveProperty("value");
  });

  it("no answer and no abstention is UNBUILDABLE", () => {
    // A body that would record a verdict no human gave must be impossible to
    // construct, not merely rejected downstream.
    expect(buildRatingBody(null, false)).toBeNull();
  });

  it("an off-scale value is refused, never coerced", () => {
    expect(
      buildRatingBody("maybe" as unknown as "yes", false)
    ).toBeNull();
  });

  it("carries a note only when there is one", () => {
    expect(buildRatingBody("no", false, CONFIDENCE_STATE_ID, "  ")).not
      .toHaveProperty("note");
    expect(
      buildRatingBody("no", false, CONFIDENCE_STATE_ID, " clipped ")
    ).toMatchObject({ note: "clipped" });
  });
});
