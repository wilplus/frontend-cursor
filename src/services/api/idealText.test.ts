import { describe, expect, it } from "vitest";
import {
  inferHistoricalStars,
  mapIdealText,
  mapInstantIdealText,
  segmentIdealText,
} from "./idealText";

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

  it("inferHistoricalStars: grey star for un-applied suggestions, never for applied/starred/plain (FE-3b)", () => {
    const ideal = mapIdealText({
      text: "alpha beta gamma delta",
      key_moments: [
        // Historical snapshot shape: suggestion WITHOUT a star field.
        {
          anchor: "alpha",
          snippet_id: "h1",
          take_session_id: "t1",
          suggestion: { kind: "replace", replacement: "x", why: "w" },
        },
        // Applied → the BE folded it; must stay star-less.
        {
          anchor: "beta",
          snippet_id: "h2",
          take_session_id: "t1",
          applied: true,
          suggestion: { kind: "replace", replacement: "y", why: "w" },
        },
        // Already starred (live shape) → untouched.
        {
          anchor: "gamma",
          snippet_id: "h3",
          take_session_id: "t1",
          star: "verified",
        },
        // Plain, no suggestion → untouched.
        { anchor: "delta", snippet_id: "h4", take_session_id: "t1" },
      ],
    });
    const out = inferHistoricalStars(ideal!);
    expect(out.keyMoments.map((m) => m.star)).toEqual([
      "suggestion",
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
