import { describe, expect, it } from "vitest";
import {
  buildRatingBody,
  type ConfidenceRatingValue,
} from "./stateRatings";

/* N3 lives HERE now: buildRatingBody is the one constructor for a label
 * write, on every surface (corpus workbench, snippet card, star overlay,
 * owner modal). It moved from trainingCorpus.ts when the binary + 1–5
 * builder was cut with the intensity row (founder 2026-08-11). The
 * invariant is unchanged: a body that would fabricate a label the rater
 * never gave must be impossible to CONSTRUCT, not merely rejected later —
 * this is training data, and a fabricated row is indistinguishable from a
 * real one afterwards. */

describe("buildRatingBody (N3 lives here)", () => {

  it("REFUSES to build a body without a real answer — a null that slipped through would fabricate a call the rater never made", () => {
    expect(buildRatingBody(null, false)).toBeNull();
    // Strings the type system would catch but a cast could smuggle: the BE
    // 400s on them, and coercing here would turn a bug into training data.
    expect(buildRatingBody("maybe" as ConfidenceRatingValue, false)).toBeNull();
    expect(buildRatingBody("" as ConfidenceRatingValue, false)).toBeNull();
  });
});
