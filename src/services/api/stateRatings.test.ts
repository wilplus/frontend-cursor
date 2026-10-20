/*
STORY    As the founder, I want it impossible to build a confidence label the
         rater never gave, so that training data never holds made-up answers.
OUTCOME
  O1  No answer, an empty answer or an unknown answer builds nothing to send.
PROVES   O1 -> "REFUSES to build a body without a real answer — a null that slipped through would fabricate a call the rater never made"
WHY      A fabricated training row can't be told from a real one afterwards.
*/
import { describe, expect, it } from "vitest";
import {
  buildRatingBody,
  type ConfidenceRatingValue,
} from "./stateRatings";

describe("buildRatingBody (N3 lives here)", () => {

  it("REFUSES to build a body without a real answer — a null that slipped through would fabricate a call the rater never made", () => {
    expect(buildRatingBody(null, false)).toBeNull();
    // Strings the type system would catch but a cast could smuggle: the BE
    // 400s on them, and coercing here would turn a bug into training data.
    expect(buildRatingBody("maybe" as ConfidenceRatingValue, false)).toBeNull();
    expect(buildRatingBody("" as ConfidenceRatingValue, false)).toBeNull();
  });
});
