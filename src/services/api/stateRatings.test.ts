import { describe, expect, it } from "vitest";
import {
  buildRatingBody,
  CONFIDENCE_RATING_VALUES,
  CONFIDENCE_STATE_ID,
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
  it("each of the five states alone is a complete rating", () => {
    for (const value of CONFIDENCE_RATING_VALUES) {
      expect(buildRatingBody(value, false)).toEqual({
        state_id: CONFIDENCE_STATE_ID,
        value,
      });
    }
  });

  it("REFUSES to build a body without a real answer — a null that slipped through would fabricate a call the rater never made", () => {
    expect(buildRatingBody(null, false)).toBeNull();
    // Strings the type system would catch but a cast could smuggle: the BE
    // 400s on them, and coercing here would turn a bug into training data.
    expect(buildRatingBody("maybe" as ConfidenceRatingValue, false)).toBeNull();
    expect(buildRatingBody("" as ConfidenceRatingValue, false)).toBeNull();
  });

  it("maps a historical unrateable control onto the explicit audio state", () => {
    expect(buildRatingBody(null, true)).toEqual({
      state_id: CONFIDENCE_STATE_ID,
      value: "audio_unclear",
    });
  });

  it("an abstention DISCARDS an answer passed alongside it rather than sending both", () => {
    expect(buildRatingBody("yes", true)).toEqual({
      state_id: CONFIDENCE_STATE_ID,
      value: "audio_unclear",
    });
  });

  it("trims the note and omits it when empty", () => {
    expect(buildRatingBody("yes", false, undefined, "  archive clip  ")).toEqual({
      state_id: CONFIDENCE_STATE_ID,
      value: "yes",
      note: "archive clip",
    });
    expect(buildRatingBody("yes", false, undefined, "   ")).toEqual({
      state_id: CONFIDENCE_STATE_ID,
      value: "yes",
    });
    // A note rides an abstention too — "audio is all wind" is exactly the
    // provenance an abstention needs.
    expect(buildRatingBody(null, true, undefined, "all wind")).toEqual({
      state_id: CONFIDENCE_STATE_ID,
      value: "audio_unclear",
      note: "all wind",
    });
  });

  it("defaults to the confidence state and carries an explicit state_id through — the instrument is state-generic, the QUESTION carries the state", () => {
    expect(buildRatingBody("no", false)?.state_id).toBe(CONFIDENCE_STATE_ID);
    expect(buildRatingBody("no", false, "some_future_state")?.state_id).toBe(
      "some_future_state"
    );
  });

  it("never carries an intensity — the 1–5 grade was cut (founder 2026-08-11) and the ternary body has no lane for it to sneak back through", () => {
    for (const value of CONFIDENCE_RATING_VALUES) {
      const body = buildRatingBody(value, false, undefined, "note");
      expect(body && "intensity" in body).toBe(false);
      expect(Object.keys(body ?? {}).sort()).toEqual([
        "note",
        "state_id",
        "value",
      ]);
    }
  });
});
