import { describe, expect, it } from "vitest";
import { mapDocumentSuggestions } from "./idealText";

/* Pins the FE mapper to the HARDENED BE tracked-changes contract
 * (services/tracked_changes.py on feat/living-transcript):
 *   top-level field `changes`; per item {id, snippet_id, kind, source,
 *   span:{start,end}, quote, proposed_text?, why?/why_key?, device?}.
 *   NO take_session_id yet (BE contract ask #2, acknowledged). */

const replace = {
  id: "s1",
  snippet_id: "s1",
  take_session_id: "t1",
  kind: "replace",
  source: "polish",
  span: { start: 2, end: 7 },
  quote: "think",
  proposed_text: "believe",
  why: "some free-text the FE must not surface",
};

describe("mapDocumentSuggestions — hardened BE `changes` shape", () => {
  it("maps a replace from span + proposed_text, nulling free-text why", () => {
    const out = mapDocumentSuggestions([replace]);
    expect(out).toHaveLength(1);
    expect(out![0]).toMatchObject({
      id: "s1",
      start: 2,
      end: 7,
      quote: "think",
      kind: "replace",
      proposedText: "believe",
      source: "polish",
      snippetId: "s1",
      takeSessionId: "t1",
      why: null, // free-text why is not one of the four keys → dropped
    });
  });

  it("reads the four-key reason from `why_key` (prior_take)", () => {
    const out = mapDocumentSuggestions([
      {
        ...replace,
        source: "prior_take",
        why: null,
        why_key: "coverage",
      },
    ]);
    expect(out![0].why).toBe("coverage");
    expect(out![0].source).toBe("prior_take");
  });

  it("keeps advice with a usable device and no proposal/pair", () => {
    const out = mapDocumentSuggestions([
      {
        id: "a1",
        snippet_id: "a1",
        kind: "advice",
        source: "delivery",
        span: { start: 0, end: 5 },
        quote: "alpha",
        device: "pause",
      },
    ]);
    expect(out![0]).toMatchObject({ kind: "advice", device: "pause" });
  });

  it("DROPS a replace/bold with no snippet+session pair (unreportable)", () => {
    // A text change the FE cannot report a decision on must not render a
    // dead Accept button — dropped, matching the mapper's other drops.
    const noPair = { ...replace, take_session_id: undefined };
    expect(mapDocumentSuggestions([noPair])).toEqual([]);
  });

  it("DROPS an advice with an unknown device (no copy → no empty modal)", () => {
    expect(
      mapDocumentSuggestions([
        {
          id: "a2",
          snippet_id: "a2",
          kind: "advice",
          source: "delivery",
          span: { start: 0, end: 5 },
          quote: "alpha",
          device: "mystery",
        },
      ])
    ).toEqual([]);
  });

  it("returns null for a missing/non-array block (absent → today's view)", () => {
    expect(mapDocumentSuggestions(undefined)).toBeNull();
    expect(mapDocumentSuggestions({})).toBeNull();
  });

  it("drops malformed rows without letting nested payloads crash the read", () => {
    expect(
      mapDocumentSuggestions([
        null,
        "not-an-object",
        { span: null, quote: "alpha", kind: "bold" },
        { span: [], quote: "alpha", kind: "bold" },
        { span: { start: 0, end: 5 }, quote: null, kind: "bold" },
      ])
    ).toEqual([]);
  });

  it("keeps the legacy top-level start/end alias", () => {
    const out = mapDocumentSuggestions([
      {
        id: 42,
        snippet_id: "s1",
        take_session_id: "t1",
        kind: "bold",
        source: "wording",
        start: 0,
        end: 5,
        quote: "alpha",
      },
    ]);
    expect(out?.[0]).toMatchObject({ id: "42", start: 0, end: 5 });
  });
});

describe("MASTER DOCUMENT — new_take block upgrade offers", () => {
  // The real BE shape: a new_take carries block_key + take_session_id, and its
  // snippet_id is deliberately NULL (the decision routes to blocks/decide).
  const blockUpgrade = {
    id: "block:10",
    snippet_id: null,
    take_session_id: "t9",
    block_key: 10,
    kind: "replace",
    source: "new_take",
    span: { start: 2, end: 7 },
    quote: "think",
    proposed_text: "believe",
    take_index: 2,
    why_key: "energy",
  };

  it("maps a block upgrade with block_key + origin badge (snippet_id null)", () => {
    const out = mapDocumentSuggestions([blockUpgrade]);
    expect(out).toHaveLength(1);
    expect(out![0]).toMatchObject({
      source: "new_take",
      blockKey: 10,
      takeIndex: 2,
      why: "energy",
      kind: "replace",
      proposedText: "believe",
      snippetId: null,
      takeSessionId: "t9",
    });
  });

  it("DROPS a new_take with no block_key (unroutable — the earlier silent-drop bug)", () => {
    const { block_key: _b, ...noBlock } = blockUpgrade;
    void _b;
    expect(mapDocumentSuggestions([noBlock])).toEqual([]);
  });

  it("DROPS a new_take with no take_session_id (blocks/decide needs the echo)", () => {
    expect(
      mapDocumentSuggestions([{ ...blockUpgrade, take_session_id: null }])
    ).toEqual([]);
  });

  it("nulls a non-numeric take_index rather than guessing a badge", () => {
    expect(
      mapDocumentSuggestions([{ ...blockUpgrade, take_index: "two" }])![0]
        .takeIndex
    ).toBeNull();
  });

  it("is approve-gated — maps as a pending OFFER, never applied", () => {
    expect(mapDocumentSuggestions([blockUpgrade])![0].status).toBeNull();
  });
});

describe("MASTER DOCUMENT — the save state as the BE actually serves it", () => {
  // _ideal_save_state serves {saved_version, saved_at, is_saved}; `is_saved`
  // is saved_version == version AND no pending offers, so a document
  // UN-saves when a new take brings offers.
  const parse = (body: Record<string, unknown>): boolean | null =>
    typeof body.is_saved === "boolean"
      ? body.is_saved
      : typeof body.saved === "boolean"
        ? body.saved
        : null;

  it("reads is_saved, the BE's field", () => {
    expect(parse({ is_saved: true, saved_version: 3 })).toBe(true);
    expect(parse({ is_saved: false, saved_version: 2 })).toBe(false);
  });

  it("tolerates a `saved` alias so a rename cannot strand the lane", () => {
    expect(parse({ saved: true })).toBe(true);
  });

  it("absent (master flag off / never saved) → null, today's CTA unchanged", () => {
    // The whole block is omitted by _ideal_save_state in that case — the
    // re-read mic must NOT vanish behind a field that is not there.
    expect(parse({})).toBeNull();
    expect(parse({ saved_version: 3 })).toBeNull();
  });
});

describe("the acoustic swap lane (founder 2026-08-13)", () => {
  // The only lane that can reach a LOCKED paragraph: the ranker excludes
  // locked parts from selection, so a later take that finally lands those
  // words has nowhere to go without this.
  const swapRow = {
    id: "c1",
    snippet_id: "s1",
    take_session_id: "t1",
    kind: "replace",
    source: "acoustic_swap",
    quote: "Second part words here.",
    proposed_text: "Second part words, better said.",
    span: { start: 24, end: 47 },
    status: "pending",
  };

  it("survives source validation instead of being nulled to unknown", () => {
    const c = mapDocumentSuggestions([swapRow] as never)?.[0];
    expect(c).toBeDefined();
    expect(c!.source).toBe("acoustic_swap");
  });

  it("carries the proposed text a replace needs to render", () => {
    const c = mapDocumentSuggestions([swapRow] as never)?.[0];
    expect(c).toBeDefined();
    expect(c!.kind).toBe("replace");
    expect(c!.proposedText).toBe("Second part words, better said.");
  });

  it("keeps the snippet + session ids the decision POST requires", () => {
    // It routes through suggestion-feedback like the other snippet-keyed
    // lanes (not the block/prior-take endpoints), and that POST refuses
    // without both ids — a swap missing one would be undecidable on screen.
    const c = mapDocumentSuggestions([swapRow] as never)?.[0];
    expect(c).toBeDefined();
    expect(c!.snippetId).toBe("s1");
    expect(c!.takeSessionId).toBe("t1");
  });
});

describe("the wording source and the Delivery label (audit findings)", () => {
  it("accepts source='wording' instead of coercing it to null", () => {
    const c = mapDocumentSuggestions([
      { ...{ id: "w1", snippet_id: "s1", take_session_id: "t1",
        kind: "replace", source: "wording", quote: "q",
        proposed_text: "p", span: { start: 0, end: 1 }, status: "pending" } },
    ] as never)?.[0];
    expect(c?.source).toBe("wording");
  });
});


describe("coach supersession proposals", () => {
  it("maps a coach revision as a fresh actionable replacement", () => {
    const c = mapDocumentSuggestions([{
      id: "coach-revision:s1",
      snippet_id: "s1",
      take_session_id: "t1",
      kind: "replace",
      source: "coach_revision",
      quote: "Machine accepted words",
      proposed_text: "Coach final words",
      coach_note: "This keeps the reasoning aligned with your point.",
      span: { start: 0, end: 22 },
    }] as never)?.[0];
    expect(c).toMatchObject({
      source: "coach_revision",
      quote: "Machine accepted words",
      proposedText: "Coach final words",
      coachNote: "This keeps the reasoning aligned with your point.",
    });
  });

  it("does not expose coach_note on a machine suggestion", () => {
    const c = mapDocumentSuggestions([{
      ...replace,
      coach_note: "must not leak through the wrong source",
    }] as never)?.[0];
    expect(c?.coachNote).toBeNull();
  });
});

describe("Confident Voice micro-practice mapping", () => {
  it("attaches a complete active exercise to the existing feedback item", () => {
    const c = mapDocumentSuggestions([{
      id: "cv-1",
      snippet_id: "snippet-1",
      take_session_id: "take-1",
      kind: "bold",
      source: "confident_voice",
      feedback_family: "confident_voice",
      quote: "Give every word enough space.",
      span: { start: 0, end: 29 },
      evidence: {
        project_id: "project-1",
        take_session_id: "take-1",
        slide_index: 1,
        paragraph_index: 2,
        span: { start: 0, end: 29 },
      },
      practice_exercise: {
        exercise_id: "hear-every-word-v1",
        version: 1,
        title: "Hear every word",
        instruction: "Read the same text again.",
        introduction: "You’re close to a confident delivery here.",
        yes_introduction: "This already sounds confident. Try this optional refinement to make the words clearer.",
        no_introduction: "You’re close. Try this exercise and see whether slowing down makes the confidence easier to hear.",
        explanation_video_ref: "https://cdn.example/coach.mp4",
        passage: "Give every word enough space.",
        practice_id: null,
        resume: false,
      },
    }] as never)?.[0];
    expect(c?.feedbackFamily).toBe("confident_voice");
    expect(c?.practiceExercise).toMatchObject({
      exerciseId: "hear-every-word-v1",
      title: "Hear every word",
      passage: "Give every word enough space.",
      resume: false,
      yesIntroduction: "This already sounds confident. Try this optional refinement to make the words clearer.",
      noIntroduction: "You’re close. Try this exercise and see whether slowing down makes the confidence easier to hear.",
    });
  });

  it("drops an exercise with no reviewed explanation video", () => {
    const c = mapDocumentSuggestions([{
      id: "cv-2", snippet_id: "s", take_session_id: "t",
      kind: "bold", source: "confident_voice",
      quote: "same text", span: { start: 0, end: 9 },
      practice_exercise: {
        exercise_id: "hear-every-word-v1", version: 1,
        title: "Hear every word", instruction: "Read again",
        introduction: "Optional", passage: "same text",
      },
    }] as never)?.[0];
    expect(c?.practiceExercise).toBeNull();
  });

  it("isolates malformed optional evidence, cues, and practice data", () => {
    const c = mapDocumentSuggestions([{
      id: "cv-3", snippet_id: "s", take_session_id: "t",
      kind: "bold", source: "confident_voice",
      quote: "same text", span: { start: 0, end: 9 },
      evidence: { span: null },
      cue_keys: { map: "not-an-array" },
      practice_exercise: { passage: { map: "not-a-string" } },
    }] as never)?.[0];

    expect(c).toBeDefined();
    expect(c?.evidence).toBeNull();
    expect(c?.cueKeys).toEqual([]);
    expect(c?.practiceExercise).toBeNull();
  });

  it("keeps exact evidence for an explicitly deckless talk section", () => {
    const c = mapDocumentSuggestions([{
      id: "cv-deckless", snippet_id: "s", take_session_id: "t",
      kind: "bold", source: "confident_voice",
      feedback_family: "confident_voice",
      quote: "same text", span: { start: 0, end: 9 },
      evidence: {
        project_id: "project-1",
        take_session_id: "t",
        slide_index: null,
        paragraph_index: 0,
        span: { start: 0, end: 9 },
      },
    }] as never)?.[0];

    expect(c?.evidence).toMatchObject({
      projectId: "project-1",
      takeSessionId: "t",
      slideIndex: null,
      paragraphIndex: 0,
    });
  });
});
