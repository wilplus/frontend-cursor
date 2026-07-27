import { describe, expect, it } from "vitest";
import {
  buildVerdictBody,
  correctionOptions,
  humanizeToken,
  mapArcStar,
  mapArcStars,
  NOTE_MAX_CHARS,
  starChipLabel,
  type ArcStar,
} from "./starVerdicts";

/** A well-formed delivery row, as the contract example serves it. */
function deliveryRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    snippet_id: "snip-1",
    star_kind: "delivery",
    star_device: "pace_fast",
    trigger: "pace_fast",
    why: "You moved faster here than you usually do.",
    replacement_text: null,
    verdict: null,
    corrected_device: null,
    note: null,
    judged: false,
    device_options: ["emphasis", "pace_fast", "pace_slow", "pause", "congruence"],
    ...over,
  };
}

function star(over: Partial<ArcStar> = {}): ArcStar {
  return {
    snippetId: "snip-1",
    starKind: "delivery",
    starDevice: "pace_fast",
    trigger: "pace_fast",
    why: null,
    replacementText: null,
    verdict: null,
    correctedDevice: null,
    note: null,
    deviceOptions: ["emphasis", "pace_fast", "pace_slow", "pause", "congruence"],
    starVersion: null,
    audioRef: null,
    startOffsetMs: 0,
    durationMs: 0,
    transcript: null,
    takeIndex: null,
    ...over,
  };
}

describe("mapArcStar — drop-not-repair", () => {
  it("maps the contract's delivery example", () => {
    expect(mapArcStar(deliveryRow())).toEqual({
      snippetId: "snip-1",
      starKind: "delivery",
      starDevice: "pace_fast",
      trigger: "pace_fast",
      why: "You moved faster here than you usually do.",
      replacementText: null,
      verdict: null,
      correctedDevice: null,
      note: null,
      deviceOptions: ["emphasis", "pace_fast", "pace_slow", "pause", "congruence"],
      starVersion: null,
      audioRef: null,
      startOffsetMs: 0,
      durationMs: 0,
      transcript: null,
      takeIndex: null,
    });
  });

  it("maps the playback context when served — the coach verifies by ear", () => {
    const m = mapArcStar(
      deliveryRow({
        audio_ref: "https://cdn.example/take-full.webm",
        start_offset_ms: 12400,
        duration_ms: 5200,
        transcript: "and that is when everything changed for us",
        take_index: 2,
      })
    );
    expect(m?.audioRef).toBe("https://cdn.example/take-full.webm");
    expect(m?.startOffsetMs).toBe(12400);
    expect(m?.durationMs).toBe(5200);
    expect(m?.transcript).toBe("and that is when everything changed for us");
    expect(m?.takeIndex).toBe(2);
  });

  it("accepts the student-payload alias snippet_audio_ref, preferring audio_ref", () => {
    expect(
      mapArcStar(deliveryRow({ snippet_audio_ref: "https://cdn.example/a.webm" }))
        ?.audioRef
    ).toBe("https://cdn.example/a.webm");
    expect(
      mapArcStar(
        deliveryRow({
          audio_ref: "https://cdn.example/primary.webm",
          snippet_audio_ref: "https://cdn.example/alias.webm",
        })
      )?.audioRef
    ).toBe("https://cdn.example/primary.webm");
  });

  it("degrades malformed playback fields to a text-only row, never a broken player", () => {
    const m = mapArcStar(
      deliveryRow({ audio_ref: 7, start_offset_ms: "12", duration_ms: -5, take_index: 0 })
    );
    expect(m?.audioRef).toBeNull();
    expect(m?.startOffsetMs).toBe(0);
    expect(m?.durationMs).toBe(0);
    expect(m?.takeIndex).toBeNull();
  });

  it("drops a row without a snippet id — the PUT is snippet-addressed, so the verdict would have nowhere to go", () => {
    expect(mapArcStar(deliveryRow({ snippet_id: "" }))).toBeNull();
    expect(mapArcStar(deliveryRow({ snippet_id: null }))).toBeNull();
  });

  it("drops a row without a star kind — the PUT must echo it verbatim", () => {
    expect(mapArcStar(deliveryRow({ star_kind: "" }))).toBeNull();
  });

  it("keeps a saved verdict as re-editable current state (N5)", () => {
    const m = mapArcStar(
      deliveryRow({
        verdict: "wrong_kind",
        corrected_device: "pace_slow",
        note: "she always talks this fast",
        judged: true,
      })
    );
    expect(m?.verdict).toBe("wrong_kind");
    expect(m?.correctedDevice).toBe("pace_slow");
    expect(m?.note).toBe("she always talks this fast");
  });

  it("degrades an unknown verdict value to unjudged rather than dropping the row — the row stays judgeable and the next save upserts over it", () => {
    expect(mapArcStar(deliveryRow({ verdict: "meh" }))?.verdict).toBeNull();
  });

  it("keeps an unknown FUTURE kind/device — this surface exists to judge new star families, not to filter them (N4)", () => {
    const m = mapArcStar(
      deliveryRow({
        star_kind: "sonority",
        star_device: "vocal_fry",
        device_options: ["vocal_fry", "uptalk"],
      })
    );
    expect(m?.starKind).toBe("sonority");
    expect(m?.starDevice).toBe("vocal_fry");
  });

  it("filters non-string entries out of device_options", () => {
    const m = mapArcStar(
      deliveryRow({ device_options: ["pause", 3, null, "", "emphasis"] })
    );
    expect(m?.deviceOptions).toEqual(["pause", "emphasis"]);
  });

  it("passes star_version through opaquely, string or number", () => {
    expect(mapArcStar(deliveryRow({ star_version: 2 }))?.starVersion).toBe(2);
    expect(mapArcStar(deliveryRow({ star_version: "v2" }))?.starVersion).toBe(
      "v2"
    );
    expect(mapArcStar(deliveryRow())?.starVersion).toBeNull();
  });
});

describe("mapArcStars", () => {
  it("keeps payload order — ordering is server-side (unjudged first, then family)", () => {
    const m = mapArcStars({
      arc_id: "arc-1",
      total: 2,
      judged: 1,
      stars: [
        deliveryRow({ snippet_id: "b" }),
        deliveryRow({ snippet_id: "a", verdict: "keep", judged: true }),
      ],
    });
    expect(m?.stars.map((s) => s.snippetId)).toEqual(["b", "a"]);
  });

  it("an empty stars array is a valid state (total: 0), not an error", () => {
    expect(mapArcStars({ arc_id: "arc-1", total: 0, stars: [] })).toEqual({
      arcId: "arc-1",
      stars: [],
    });
  });

  it("returns null when stars is not an array — a malformed payload must not render as 'no stars fired'", () => {
    expect(mapArcStars({ arc_id: "arc-1" })).toBeNull();
    expect(mapArcStars(null)).toBeNull();
    expect(mapArcStars("nope")).toBeNull();
  });

  it("never maps the summary — confusions and false_negatives_captured are internal bookkeeping", () => {
    const m = mapArcStars({
      arc_id: "arc-1",
      stars: [],
      summary: { confusions: { "pace_fast->pace_slow": 1 } },
    });
    expect(JSON.stringify(m)).not.toContain("confusions");
  });
});

describe("correctionOptions (N4)", () => {
  it("serves the payload's device_options minus the star's own device", () => {
    expect(correctionOptions(star())).toEqual([
      "emphasis",
      "pace_slow",
      "pause",
      "congruence",
    ]);
  });

  it("falls back to the OTHER families when device_options is empty (single-device kinds)", () => {
    expect(
      correctionOptions(
        star({ starKind: "replace", starDevice: null, trigger: "threat", deviceOptions: [] })
      )
    ).toEqual(["emphasize", "structure", "delivery"]);
  });

  it("filters self via trigger when star_device is null (structure rows)", () => {
    expect(
      correctionOptions(
        star({
          starKind: "structure",
          starDevice: null,
          trigger: "contrast",
          deviceOptions: ["contrast", "list_of_three"],
        })
      )
    ).toEqual(["list_of_three"]);
  });

  it("offers a future family's served options untouched — no hard-coded list to drift", () => {
    expect(
      correctionOptions(
        star({ starKind: "sonority", starDevice: "vocal_fry", trigger: null, deviceOptions: ["vocal_fry", "uptalk"] })
      )
    ).toEqual(["uptalk"]);
  });
});

describe("buildVerdictBody (N3 lives here)", () => {
  it("keep: echoes star_kind/star_device verbatim, nothing else", () => {
    expect(buildVerdictBody(star(), "keep")).toEqual({
      star_kind: "delivery",
      star_device: "pace_fast",
      verdict: "keep",
    });
  });

  it("echoes a null star_device as null — never reconstructs it", () => {
    expect(
      buildVerdictBody(star({ starKind: "structure", starDevice: null }), "should_not_fire")
    ).toEqual({
      star_kind: "structure",
      star_device: null,
      verdict: "should_not_fire",
    });
  });

  it("REFUSES a wrong_kind without a correction — the 400 the BE would return is unconstructable (N3)", () => {
    expect(buildVerdictBody(star(), "wrong_kind")).toBeNull();
    expect(buildVerdictBody(star(), "wrong_kind", { correctedDevice: "" })).toBeNull();
    expect(buildVerdictBody(star(), "wrong_kind", { correctedDevice: "  " })).toBeNull();
  });

  it("wrong_kind with a correction builds the labeled confusion pair", () => {
    expect(
      buildVerdictBody(star(), "wrong_kind", {
        correctedDevice: "pace_slow",
        note: "she always talks this fast — this is her normal",
      })
    ).toEqual({
      star_kind: "delivery",
      star_device: "pace_fast",
      verdict: "wrong_kind",
      corrected_device: "pace_slow",
      note: "she always talks this fast — this is her normal",
    });
  });

  it("trims the note, omits it when empty, and clamps it to the BE cap", () => {
    expect(buildVerdictBody(star(), "keep", { note: "  " })).toEqual({
      star_kind: "delivery",
      star_device: "pace_fast",
      verdict: "keep",
    });
    const long = "x".repeat(NOTE_MAX_CHARS + 50);
    expect(buildVerdictBody(star(), "keep", { note: long })?.note).toHaveLength(
      NOTE_MAX_CHARS
    );
  });

  it("passes star_version through only when the row carried it", () => {
    expect(buildVerdictBody(star({ starVersion: 3 }), "keep")?.star_version).toBe(3);
    expect(buildVerdictBody(star(), "keep")).not.toHaveProperty("star_version");
  });
});

describe("labels", () => {
  it("humanizes wire tokens without a copy table (N4): new devices render legibly unchanged", () => {
    expect(humanizeToken("pace_fast")).toBe("pace fast");
    expect(humanizeToken("list_of_three")).toBe("list of three");
    expect(humanizeToken("vocal_fry")).toBe("vocal fry");
  });

  it("chips read kind · device, or kind alone when the star has no device", () => {
    expect(starChipLabel(star())).toBe("Delivery · pace fast");
    expect(starChipLabel(star({ starKind: "replace", starDevice: null }))).toBe(
      "Replace"
    );
  });
});
