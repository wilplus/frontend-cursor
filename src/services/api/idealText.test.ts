import { describe, expect, it } from "vitest";
import {
  mapIdealText,
  mapInstantIdealText,
  mapKeyPoints,
  segmentIdealText,
  keyPointTintRanges,
} from "./idealText";

describe("mapKeyPoints (E-2 presentation cues)", () => {
  it("maps rows; absent block → null; drops textless rows", () => {
    const out = mapKeyPoints([
      { block_key: 3, block_label: "Opening", text: "Land the hook", start: 0, end: 13 },
      { text: "" }, // no cue text → dropped
      { block_label: "Close", text: "One ask" }, // no key/range → nulls, still maps
    ]);
    expect(out).toHaveLength(2);
    expect(out![0]).toEqual({
      blockKey: 3,
      blockLabel: "Opening",
      text: "Land the hook",
      start: 0,
      end: 13,
    });
    expect(out![1]).toMatchObject({ blockKey: null, start: null, end: null });
  });

  it("returns null when absent (flag off) → toggle hidden", () => {
    expect(mapKeyPoints(undefined)).toBeNull();
    expect(mapKeyPoints({})).toBeNull();
  });
});

describe("segmentIdealText (delivery layer notebook)", () => {
  const moments = [
    { anchor: "turned stress into charisma", snippetId: "s1", takeSessionId: "t1" },
  ];

  it("bolds the first key phrase and underlines the first anchor occurrence", () => {
    const segs = segmentIdealText(
      "Good morning everyone. Here I turned stress into charisma, truly.",
      ["Good morning"],
      moments
    );
    expect(segs.map((s) => s.text).join("")).toBe(
      "Good morning everyone. Here I turned stress into charisma, truly."
    );
    const bold = segs.find((s) => s.bold);
    expect(bold?.text).toBe("Good morning");
    const linked = segs.find((s) => s.moment);
    expect(linked?.text).toBe("turned stress into charisma");
    expect(linked?.moment?.snippetId).toBe("s1");
  });

  it("matches case-insensitively but preserves the original casing", () => {
    const segs = segmentIdealText("TURNED STRESS INTO CHARISMA now", [], moments);
    expect(segs[0].text).toBe("TURNED STRESS INTO CHARISMA");
    expect(segs[0].moment?.snippetId).toBe("s1");
  });

  it("drops overlapping ranges (earlier start wins) and unmatched anchors", () => {
    const segs = segmentIdealText(
      "alpha beta gamma",
      ["beta gamma"],
      [
        { anchor: "alpha beta", snippetId: "s1", takeSessionId: "t" },
        { anchor: "not present", snippetId: "s2", takeSessionId: "t" },
      ]
    );
    // "alpha beta" (moment) accepted; overlapping phrase "beta gamma" dropped.
    expect(segs.filter((s) => s.moment).length).toBe(1);
    expect(segs.filter((s) => s.bold).length).toBe(0);
    expect(segs.map((s) => s.text).join("")).toBe("alpha beta gamma");
  });

  it("never slices a rich-marker token (FE-9): in-token matches drop, contained tokens pass", () => {
    // Key phrase sits INSIDE {{orange:…}} — accepting it would split the braces
    // across segments and leak raw "{{orange:" / "}}" into the notebook.
    const inToken = segmentIdealText(
      "start {{orange:great opener}} end",
      ["great opener"],
      []
    );
    expect(inToken.filter((s) => s.bold).length).toBe(0);
    expect(inToken.map((s) => s.text).join("")).toBe(
      "start {{orange:great opener}} end"
    );
    // A token FULLY inside the matched range is fine — the segment's own
    // marker rendering handles it.
    const contained = segmentIdealText(
      "the **great** opener works",
      ["the **great** opener"],
      []
    );
    expect(contained[0].bold).toBe(true);
    expect(contained[0].text).toBe("the **great** opener");
  });

  it("returns [] for empty text and whole-text single segment when nothing matches", () => {
    expect(segmentIdealText("", ["x"], [])).toEqual([]);
    expect(segmentIdealText("plain words", ["zzz"], [])).toEqual([
      { text: "plain words" },
    ]);
  });
});

describe("mapIdealText", () => {
  it("maps the wire shape, defaulting notes to null", () => {
    const v = mapIdealText({
      text: "T",
      key_phrases: ["a", ""],
      key_moments: [
        { anchor: "T", snippet_id: "s", take_session_id: "k" },
        { anchor: "", snippet_id: "x", take_session_id: "k" }, // dropped
      ],
      approved: true,
    });
    expect(v?.keyPhrases).toEqual(["a"]);
    expect(v?.keyMoments).toEqual([
      {
        anchor: "T",
        snippetId: "s",
        takeSessionId: "k",
        momentId: null,
        hasExplanation: false,
        // MOMENT_SUGGESTIONS — all default to no-star (safe-ahead).
        star: null,
        suggestion: null,
        applied: false,
        coach: null,
        snippetAudioRef: null,
        startOffsetMs: null,
        durationMs: null,
      },
    ]);
    expect(v?.approved).toBe(true);
    expect(v?.notes).toBeNull();
  });

  it("maps MOMENT_SUGGESTIONS fields — a grey replace suggestion", () => {
    const v = mapIdealText({
      text: "hello world",
      key_moments: [
        {
          anchor: "world",
          snippet_id: "s1",
          take_session_id: "t1",
          star: "suggestion",
          applied: false,
          suggestion: { kind: "replace", replacement: "everyone", why: "warmer" },
          snippet_audio_ref: "https://cdn/a.mp3",
        },
      ],
    });
    expect(v?.keyMoments[0]).toMatchObject({
      star: "suggestion",
      applied: false,
      suggestion: { kind: "replace", replacement: "everyone", why: "warmer" },
      coach: null,
      snippetAudioRef: "https://cdn/a.mp3",
    });
  });

  it("maps only the closed Confident Voice coach-review states", () => {
    const v = mapIdealText({
      text: "steady opening",
      key_moments: [
        {
          anchor: "steady opening",
          snippet_id: "s-review",
          take_session_id: "t-review",
          confidence_review_status: "pending_coach_review",
        },
      ],
    });
    expect(v?.keyMoments[0]?.reviewStatus).toBe("pending_coach_review");
  });

  it("maps a verified (orange) star with a coach video, applied", () => {
    const v = mapIdealText({
      text: "hello world",
      key_moments: [
        {
          anchor: "hello",
          snippet_id: "s2",
          take_session_id: "t1",
          star: "verified",
          applied: true,
          coach: { has_message: true, has_video: true },
        },
      ],
    });
    expect(v?.keyMoments[0]).toMatchObject({
      star: "verified",
      applied: true,
      suggestion: null,
      coach: { hasMessage: true, hasVideo: true },
    });
  });

  it("ignores a bad star value and a non-object suggestion (safe-ahead)", () => {
    const v = mapIdealText({
      text: "hello world",
      key_moments: [
        {
          anchor: "hello",
          snippet_id: "s3",
          take_session_id: "t1",
          star: "bogus",
          suggestion: "not-an-object",
        },
      ],
    });
    expect(v?.keyMoments[0]).toMatchObject({ star: null, suggestion: null });
  });

  it("maps the playback slice, and nulls unusable offsets so the player falls back to unclamped", () => {
    const v = mapIdealText({
      text: "hello world",
      key_moments: [
        {
          anchor: "hello",
          snippet_id: "s6",
          take_session_id: "t1",
          snippet_audio_ref: "https://cdn/full.webm",
          start_offset_ms: 12_000,
          duration_ms: 4_500,
        },
        {
          anchor: "world",
          snippet_id: "s7",
          take_session_id: "t1",
          snippet_audio_ref: "https://cdn/full.webm",
          start_offset_ms: null,
          duration_ms: "nope",
        },
      ],
    });
    expect(v?.keyMoments[0]).toMatchObject({
      startOffsetMs: 12_000,
      durationMs: 4_500,
    });
    expect(v?.keyMoments[1]).toMatchObject({
      startOffsetMs: null,
      durationMs: null,
    });
  });

  it("maps the polish trigger, and clamps anything else to null (POLISH_AS_SUGGESTIONS)", () => {
    const v = mapIdealText({
      text: "hello world there",
      key_moments: [
        {
          anchor: "hello",
          snippet_id: "p1",
          take_session_id: "t1",
          star: "suggestion",
          suggestion: { kind: "replace", replacement: "hi", why: null, trigger: "polish" },
        },
        {
          anchor: "world",
          snippet_id: "p2",
          take_session_id: "t1",
          star: "suggestion",
          // An internal trigger must never reach the copy layer.
          suggestion: { kind: "replace", replacement: "earth", why: "w", trigger: "stickiness" },
        },
        {
          anchor: "there",
          snippet_id: "p3",
          take_session_id: "t1",
          star: "suggestion",
          suggestion: { kind: "replace", replacement: "here", why: "w" },
        },
      ],
    });
    expect(v?.keyMoments[0].suggestion).toMatchObject({ trigger: "polish" });
    expect(v?.keyMoments[1].suggestion).toMatchObject({ trigger: null });
    expect(v?.keyMoments[2].suggestion).toMatchObject({ trigger: null });
  });

  it("maps the narrow quote on edit suggestions, nulling blank/absent (FE-2)", () => {
    const v = mapIdealText({
      text: "hello world there",
      key_moments: [
        {
          anchor: "hello",
          snippet_id: "q1",
          take_session_id: "t1",
          star: "suggestion",
          suggestion: {
            kind: "replace",
            replacement: "hi",
            why: "w",
            quote: "the turn",
          },
        },
        {
          anchor: "world",
          snippet_id: "q2",
          take_session_id: "t1",
          star: "suggestion",
          // Whitespace-only → null: never underline an invisible span.
          suggestion: { kind: "emphasize", replacement: null, why: "w", quote: "  " },
        },
        {
          anchor: "there",
          snippet_id: "q3",
          take_session_id: "t1",
          star: "suggestion",
          // Older BE payload without the field → null (icon-only star).
          suggestion: { kind: "replace", replacement: "here", why: "w" },
        },
      ],
    });
    expect(v?.keyMoments[0].suggestion).toMatchObject({ quote: "the turn" });
    expect(v?.keyMoments[1].suggestion).toMatchObject({ quote: null });
    expect(v?.keyMoments[2].suggestion).toMatchObject({ quote: null });
  });

  it("the FE never mints a star the BE omitted (sole-gatekeeper rip, 2026-08-10)", () => {
    // inferHistoricalStars is DELETED: it inferred suggestion stars on
    // historical payloads, which made the FE itself an ungated intervention
    // source. A payload without a star renders without a star — only the
    // coach's verified star survives as an explicit field.
    const ideal = mapIdealText({
      text: "alpha beta gamma delta",
      key_moments: [
        {
          anchor: "alpha",
          snippet_id: "h1",
          take_session_id: "t1",
          suggestion: { kind: "replace", replacement: "x", why: "w" },
        },
        {
          anchor: "gamma",
          snippet_id: "h3",
          take_session_id: "t1",
          star: "verified",
        },
        { anchor: "delta", snippet_id: "h4", take_session_id: "t1" },
      ],
    });
    expect(ideal!.keyMoments.map((m) => m.star)).toEqual([
      null,
      "verified",
      null,
    ]);
  });

  it("maps a STRUCTURAL suggestion (device + verbatim quote) behind the star", () => {
    const v = mapIdealText({
      text: "hello world",
      key_moments: [
        {
          anchor: "hello",
          snippet_id: "s8",
          take_session_id: "t1",
          star: "suggestion",
          suggestion: {
            kind: "structure",
            device: "contrast",
            quote: "not this, but that",
          },
        },
        {
          anchor: "world",
          snippet_id: "s9",
          take_session_id: "t1",
          star: "suggestion",
          suggestion: { kind: "structure", device: "list_of_three", quote: "  " },
        },
      ],
    });
    expect(v?.keyMoments[0]).toMatchObject({
      star: "suggestion",
      suggestion: { kind: "structure", device: "contrast", quote: "not this, but that" },
    });
    // A blank quote maps to null; the sheet shows the copy without an excerpt.
    expect(v?.keyMoments[1]).toMatchObject({
      star: "suggestion",
      suggestion: { kind: "structure", device: "list_of_three", quote: null },
    });
  });

  it("maps a DELIVERY suggestion by device, and degrades an unknown device", () => {
    const v = mapIdealText({
      text: "hello world",
      key_moments: [
        {
          anchor: "hello",
          snippet_id: "d1",
          take_session_id: "t1",
          star: "suggestion",
          suggestion: { kind: "delivery", device: "pace_fast", why: "faster than usual" },
        },
        {
          anchor: "world",
          snippet_id: "d2",
          take_session_id: "t1",
          star: "suggestion",
          // Not one of the four measured devices → no sheet copy → degrade.
          suggestion: { kind: "delivery", device: "mumbling" },
        },
      ],
    });
    expect(v?.keyMoments[0]).toMatchObject({
      star: "suggestion",
      suggestion: { kind: "delivery", device: "pace_fast" },
    });
    expect(v?.keyMoments[1]).toMatchObject({ star: null, suggestion: null });
  });

  it("maps the CONGRUENCE delivery device through the same star path", () => {
    // The content↔delivery gap is a fifth device on the EXISTING family, not a
    // new surface: it must parse into the same {kind:"delivery"} shape so it
    // draws the same grey star and opens the same DeliveryStarCard.
    const v = mapIdealText({
      text: "hello world",
      key_moments: [
        {
          anchor: "hello",
          snippet_id: "d1",
          take_session_id: "t1",
          star: "suggestion",
          suggestion: { kind: "delivery", device: "congruence" },
        },
      ],
    });
    expect(v?.keyMoments[0]).toMatchObject({
      star: "suggestion",
      // Anchored at the fragment, exactly like every other feedback.
      anchor: "hello",
      suggestion: { kind: "delivery", device: "congruence" },
    });
  });

  it("degrades a structural star with an UNKNOWN device to a plain moment", () => {
    // The fixed copy is keyed off device, so a device we can't name has no
    // sheet to show — same degrade rule as a missing suggestion (R-ms3).
    const v = mapIdealText({
      text: "hello world",
      key_moments: [
        {
          anchor: "hello",
          snippet_id: "s10",
          take_session_id: "t1",
          star: "suggestion",
          suggestion: { kind: "structure", device: "rhetorical-question", quote: "x" },
        },
      ],
    });
    expect(v?.keyMoments[0]).toMatchObject({ star: null, suggestion: null });
  });

  it("degrades a suggestion star WITHOUT a usable suggestion to a plain moment (R-ms3)", () => {
    // A grey (free) star must never fall through to the paid coach path; with
    // no suggestion payload the star drops and the moment renders plain.
    const v = mapIdealText({
      text: "hello world",
      key_moments: [
        { anchor: "hello", snippet_id: "s4", take_session_id: "t1", star: "suggestion" },
        {
          anchor: "world",
          snippet_id: "s5",
          take_session_id: "t1",
          star: "suggestion",
          suggestion: { kind: "bogus-kind" },
        },
      ],
    });
    expect(v?.keyMoments[0]).toMatchObject({ star: null, suggestion: null });
    expect(v?.keyMoments[1]).toMatchObject({ star: null, suggestion: null });
  });

  it("nulls on missing text", () => {
    expect(mapIdealText({ key_phrases: [] })).toBeNull();
    expect(mapIdealText(null)).toBeNull();
  });
});

describe("mapInstantIdealText (instant lane, free)", () => {
  it("maps the instant payload: text + moments, no notes", () => {
    const r = mapInstantIdealText({
      arc_id: "a1",
      variant: "instant",
      text: "Draft text",
      key_moments: [{ anchor: "Draft", snippet_id: "s", take_session_id: "k" }],
      approved: false,
    });
    expect(r?.kind).toBe("instant");
    expect(r?.ideal.text).toBe("Draft text");
    expect(r?.ideal.approved).toBe(false);
    expect(r?.ideal.notes).toBeNull();
  });

  it("nulls when the payload has no text (caller degrades to pending)", () => {
    expect(mapInstantIdealText({ variant: "instant" })).toBeNull();
  });
});

describe("coach reference (FE-5)", () => {
  // A key moment is keyed on `anchor`; a row without one is dropped.
  const withCoach = (coach: unknown) => ({
    text: "hello world",
    key_moments: [
      {
        anchor: "hello",
        snippet_id: "s1",
        take_session_id: "t1",
        coach,
      },
    ],
  });

  it("maps a reference the coach attached", () => {
    const r = mapIdealText(
      withCoach({
        has_message: true,
        has_video: false,
        reference: {
          slug: "why-your-voice-shakes",
          title: "Why your voice shakes",
          url: "/blog/why-your-voice-shakes",
        },
      })
    );
    const ref = r?.keyMoments?.[0]?.coach?.reference;
    expect(ref?.title).toBe("Why your voice shakes");
    expect(ref?.url).toBe("/blog/why-your-voice-shakes");
  });

  it("is null when the key is absent, so nothing renders", () => {
    const r = mapIdealText(
      withCoach({ has_message: true, has_video: false })
    );
    const coach = r?.keyMoments?.[0]?.coach;
    expect(coach?.reference ?? null).toBeNull();
  });

  it("builds the /blog path from the slug when url is missing", () => {
    const r = mapIdealText(
      withCoach({
        has_message: true,
        has_video: false,
        reference: { slug: "a-post", title: "A post" },
      })
    );
    const ref = r?.keyMoments?.[0]?.coach?.reference;
    expect(ref?.url).toBe("/blog/a-post");
  });

  it("drops a reference with no usable title, rather than linking blank text", () => {
    const r = mapIdealText(
      withCoach({
        has_message: true,
        has_video: false,
        reference: { slug: "a-post", title: "" },
      })
    );
    const coach = r?.keyMoments?.[0]?.coach;
    expect(coach?.reference ?? null).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  FE-7 — the key-point tint. The rule that matters is VERIFY BEFORE TINTING:  */
/*  a stale offset that paints anyway accents words the coach never marked.     */
/* -------------------------------------------------------------------------- */

describe("keyPointTintRanges", () => {
  const kp = (text: string, start: number | null, end: number | null) => ({
    blockKey: null,
    blockLabel: "",
    text,
    start,
    end,
  });

  it("tints a cue whose slice matches the served text exactly", () => {
    const text = "say it louder and clearer";
    expect(keyPointTintRanges(text, [kp("louder", 7, 13)])).toEqual([[7, 13]]);
  });

  it("drops a cue whose slice does NOT match, silently", () => {
    const text = "say it louder and clearer";
    // The offsets point at "der an" — a stale anchor after an edit.
    expect(keyPointTintRanges(text, [kp("louder", 10, 16)])).toEqual([]);
  });

  it("indexes the SERVED text, markers included", () => {
    // The cue sits after an accent, so its offset includes the marker width.
    // Computing on the stripped string would slide it left by 9 characters.
    const text = "{{orange:say it}} louder";
    expect(keyPointTintRanges(text, [kp("louder", 18, 24)])).toEqual([[18, 24]]);
    expect(keyPointTintRanges(text, [kp("louder", 9, 15)])).toEqual([]);
  });

  it("keeps a cue with no offsets off the text (the card still renders)", () => {
    expect(keyPointTintRanges("some text", [kp("some", null, null)])).toEqual([]);
  });

  it("refuses ranges that are out of bounds, inverted or empty", () => {
    const text = "short";
    expect(keyPointTintRanges(text, [kp("short", 0, 99)])).toEqual([]);
    expect(keyPointTintRanges(text, [kp("short", 3, 1)])).toEqual([]);
    expect(keyPointTintRanges(text, [kp("", 2, 2)])).toEqual([]);
    expect(keyPointTintRanges(text, [kp("short", -1, 5)])).toEqual([]);
  });

  it("is empty for an absent or empty key-point list", () => {
    expect(keyPointTintRanges("text", null)).toEqual([]);
    expect(keyPointTintRanges("text", [])).toEqual([]);
    expect(keyPointTintRanges("", [kp("x", 0, 1)])).toEqual([]);
  });

  it("returns positions only — no rank, no order index, no score (AC-9)", () => {
    const text = "one two three";
    const out = keyPointTintRanges(text, [kp("one", 0, 3), kp("three", 8, 13)]);
    expect(out).toEqual([
      [0, 3],
      [8, 13],
    ]);
  });
});
