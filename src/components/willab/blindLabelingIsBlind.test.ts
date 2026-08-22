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
/*  This file checks the render surface directly so a machine-derived field    */
/*  cannot slip into the blind labeler's own payload unnoticed.                */
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

describe("the card resumes the coach's OWN answer", () => {
  it("seeds its rating state from the persisted coach state", () => {
    // The amnesia fix. Without this the card reopened as unanswered, and a
    // coach either re-rated from scratch — a second, non-independent look at
    // one clip — or skipped it as already done and left it unrated.
    const src = code(CARD);
    expect(src).toContain("seeded.ratingValue");
    expect(src).toContain("seeded.ratingUnrateable");
  });

  it("never reads a rating that is not the coach's own", () => {
    // The BE scopes the read to the authenticated rater. Nothing here may
    // reach for a panel/other-rater shape — that would anchor the next label
    // exactly the way a visible machine read would.
    const src = code(CARD);
    expect(src).not.toMatch(/otherRat|panelRating|allRatings|raters\b/);
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

describe("the record -> analyse -> read cycle is locked in both directions", () => {
  const LOUNGE = join("components", "willab", "Lounge.tsx");
  const OVERLAY = join("components", "willab", "IdealTextOverlay.tsx");

  it("the record button holds while a take is in flight", () => {
    // Third generation (SPEC-lockin-loop §1): the predicate widened from
    // "analysing" to "in flight" — the document phase (readout done, text
    // still assembling) holds the button too, because a take started then
    // races the version being written exactly the same way.
    expect(code(LOUNGE)).toContain("disabled={takeInFlight}");
  });

  it("record and the ideal text block on the SAME truth", () => {
    // One predicate, two consumers. If these ever split, the button and the
    // blocking screen can disagree about whether a take is being worked —
    // which is how stale text gets read behind a live Record button.
    expect(code(LOUNGE)).toContain(
      'processingResume?.status === "analyzing" || documentSettle.pending'
    );
  });

  it("the ideal text opens into a WAIT, never onto stale words", () => {
    // Third generation of this gate (SPEC-lockin-loop §1). The first held
    // the tap with a silent `return`; the second opened the overlay with
    // `analysisPending` derived from the analysis phase only — which cleared
    // at readout_ready, BEFORE the document assembled (handoff §6.4 S3).
    // Now the prop rides `takeInFlight`, which stays true through the
    // document phase until the settle probe sees the new text.
    expect(code(LOUNGE)).toContain("analysisPending={takeInFlight}");
    const overlay = code(OVERLAY);
    const effect = overlay.slice(overlay.indexOf("const firstLoad"));
    const gate = effect.slice(0, effect.indexOf("fetchIdealText"));
    expect(gate).toContain("analysisPending");
    expect(gate).toContain("return");
  });

  it("the readout going terminal TRANSITIONS the marker — it never clears it", () => {
    // Handoff §6.4 S3 — the exact window the founder kept hitting: marker
    // cleared at readout_ready, document still the previous version, blocking
    // screen gone. Both watchers now hand the marker to the document phase,
    // and only the settle probe (or its bounded cap) may clear it.
    const lounge = code(LOUNGE);
    const terminal = lounge.slice(
      lounge.indexOf('r.state === "readout_ready"'),
      lounge.indexOf("const documentSettle")
    );
    expect(terminal).toContain("transitionProcessingTakeToDocument");
    expect(terminal).not.toContain("clearProcessingTake");
    const lab = code(join("components", "willab", "LabOverlay.tsx"));
    const labTerminal = lab.slice(
      lab.indexOf('r.state === "readout_ready"'),
      lab.indexOf("setReadout(r.readout)")
    );
    expect(labTerminal).toContain("transitionProcessingTakeToDocument");
    expect(labTerminal).not.toContain("clearProcessingTake");
  });

  it("the in-Lab readout blocks too — S3's other half", () => {
    // IdealTextReadout used to fetch on mount and adopt the PRIOR take's
    // document, with no pending gate and no completion-driven refetch.
    const readout = code(join("components", "willab", "IdealTextReadout.tsx"));
    expect(readout).toContain("if (analysisPending) return;");
    expect(readout).toMatch(/\[signedIn, arcId, analysisPending, sdNonce/);
    const lab = code(join("components", "willab", "LabOverlay.tsx"));
    expect(lab).toContain("analysisPending={documentSettle.pending}");
  });

  it("the picker-mounted overlay is no longer the unguarded back door (S6)", () => {
    const surface = code(join("components", "willab", "WillabSurface.tsx"));
    expect(surface).toContain("analysisPending={pickerSettle.pending}");
  });

  it("completion reaches an OPEN document too", () => {
    // W5 — the flip of `analysisPending` must re-run the fetch effect, so a
    // student reading while the analysis lands gets the fresh document in
    // place rather than a stale one until they touch something.
    expect(code(OVERLAY)).toMatch(
      /\[arcId, analysisPending, refetchNonce/
    );
  });

  it("the tap no longer dead-ends in a silent return", () => {
    const src = code(LOUNGE);
    const handler = src.slice(src.indexOf("function openIdealText("));
    const body = handler.slice(0, handler.indexOf("function continueJourneyProject"));
    expect(body).not.toMatch(/processingResume.*return/s);
  });

  it("the routing introduces no new user-facing copy", () => {
    // LIVE LOOP: the overlay's existing loading state carries the wait; no
    // new string may ship from this change.
    const src = code(LOUNGE);
    const handler = src.slice(src.indexOf("function openIdealText("));
    const body = handler.slice(0, handler.indexOf("function continueJourneyProject"));
    expect(body).not.toMatch(/alert\(|toast|"[A-Z][a-z]+ [a-z]/);
  });
});

describe("a failed take stays on screen until the user acts (W6)", () => {
  const LOUNGE = join("components", "willab", "Lounge.tsx");

  it("no self-clearing timer remains", () => {
    // 10 seconds of visibility is halfway to "never happened": look away
    // once and there is no evidence anything went wrong.
    const src = code(LOUNGE);
    expect(src).not.toContain("failNoteTimerRef");
    expect(src).not.toMatch(/setTimeout\(\s*\(\)\s*=>\s*setProcessingResume\(null\)/);
  });

  it("idle state changes preserve a failed note; entering the Lab clears it", () => {
    const src = code(LOUNGE);
    expect(src).toContain(
      'setProcessingResume((prev) => (prev?.status === "failed" ? prev : null))'
    );
    expect(src).toContain(
      'setProcessingResume((prev) => (prev?.status === "failed" ? null : prev))'
    );
  });
});
