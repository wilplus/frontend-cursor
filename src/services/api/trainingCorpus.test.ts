import { describe, expect, it } from "vitest";
import {
  buildLabelBody,
  mapConfidenceQueue,
  mapQueuePiece,
  mapTrainingImport,
} from "./trainingCorpus";

function piece(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    snippet_id: "snip-1",
    transcript: "and that is when everything changed for us",
    audio_ref: "https://cdn.example/take.webm",
    start_offset_ms: 12345,
    duration_ms: 4200,
    session_id: "sess-1",
    label: null,
    ...over,
  };
}

describe("mapQueuePiece — drop-not-repair", () => {
  it("maps the contract's queue row", () => {
    expect(mapQueuePiece(piece())).toEqual({
      snippetId: "snip-1",
      transcript: "and that is when everything changed for us",
      audioRef: "https://cdn.example/take.webm",
      startOffsetMs: 12345,
      durationMs: 4200,
      label: null,
    });
  });

  it("drops a row with no snippet id — the label PUT would have nowhere to go", () => {
    expect(mapQueuePiece(piece({ snippet_id: "" }))).toBeNull();
  });

  it("drops a row with no transcript — nothing to read alongside the audio", () => {
    expect(mapQueuePiece(piece({ transcript: "" }))).toBeNull();
  });

  it("keeps this coach's prior call, intensity included", () => {
    const m = mapQueuePiece(piece({ label: { confident: true, intensity: 4 } }));
    expect(m?.label).toEqual({ confident: true, intensity: 4 });
  });

  it("keeps a yes/no call that was never graded", () => {
    expect(
      mapQueuePiece(piece({ label: { confident: false } }))?.label
    ).toEqual({ confident: false, intensity: null });
  });

  it("treats a non-boolean confident as UNLABELLED — the piece gets asked again rather than showing a call the coach never gave", () => {
    expect(mapQueuePiece(piece({ label: { confident: "true" } }))?.label).toBeNull();
    expect(mapQueuePiece(piece({ label: { intensity: 3 } }))?.label).toBeNull();
  });

  it("drops an out-of-range or fractional intensity instead of clamping it — a clamped 9 would silently become a 5 nobody picked", () => {
    for (const bad of [0, 6, 9, 2.5, "4", null]) {
      expect(
        mapQueuePiece(piece({ label: { confident: true, intensity: bad } }))
          ?.label?.intensity
      ).toBeNull();
    }
  });
});

describe("mapConfidenceQueue", () => {
  it("keeps payload order — the queue is band-shuffled so position is not a tell (N2)", () => {
    const m = mapConfidenceQueue({
      session_id: "sess-1",
      count: 3,
      labelled: 1,
      queue: [
        piece({ snippet_id: "c" }),
        piece({ snippet_id: "a", label: { confident: true, intensity: 5 } }),
        piece({ snippet_id: "b" }),
      ],
    });
    expect(m?.queue.map((p) => p.snippetId)).toEqual(["c", "a", "b"]);
  });

  it("an empty queue is a valid state, not an error", () => {
    expect(mapConfidenceQueue({ session_id: "s", queue: [] })).toEqual({
      sessionId: "s",
      queue: [],
    });
  });

  it("returns null when queue is not an array — a malformed payload must not read as 'nothing to label'", () => {
    expect(mapConfidenceQueue({ session_id: "s" })).toBeNull();
    expect(mapConfidenceQueue(null)).toBeNull();
  });

  it("never surfaces a band or machine read even if one were served (N1)", () => {
    const m = mapConfidenceQueue({
      session_id: "s",
      queue: [piece({ band: "high", confidence_score: 0.91 })],
    });
    expect(JSON.stringify(m)).not.toContain("band");
    expect(JSON.stringify(m)).not.toContain("confidence_score");
  });
});

describe("buildLabelBody (N3 lives here)", () => {
  it("yes/no alone is a complete label — intensity is optional", () => {
    expect(buildLabelBody(true)).toEqual({ confident: true });
    expect(buildLabelBody(false)).toEqual({ confident: false });
  });

  it("REFUSES to build a body without a real boolean — an intensity-only save would fabricate a call the coach never made", () => {
    expect(buildLabelBody(undefined, 4)).toBeNull();
    expect(buildLabelBody(null, 4)).toBeNull();
    // The BE 400s on a string "true"; coercing it here would turn a bug into
    // fabricated training data, so it is refused rather than repaired.
    expect(buildLabelBody("true", 4)).toBeNull();
    expect(buildLabelBody(1)).toBeNull();
  });

  it("carries a 1–5 grade", () => {
    expect(buildLabelBody(true, 4)).toEqual({ confident: true, intensity: 4 });
  });

  it("drops an out-of-range grade but keeps the answer — the coach's yes/no still stands", () => {
    expect(buildLabelBody(true, 9)).toEqual({ confident: true });
    expect(buildLabelBody(true, 0)).toEqual({ confident: true });
    expect(buildLabelBody(true, 3.5)).toEqual({ confident: true });
  });

  it("trims the note and omits it when empty", () => {
    expect(buildLabelBody(true, 2, "  archive clip  ")).toEqual({
      confident: true,
      intensity: 2,
      note: "archive clip",
    });
    expect(buildLabelBody(true, 2, "   ")).toEqual({
      confident: true,
      intensity: 2,
    });
  });
});

describe("mapTrainingImport", () => {
  it("maps an index row", () => {
    expect(
      mapTrainingImport({
        session_id: "sess-1",
        arc_id: "arc-1",
        topic: "Board pitch",
        speaker_label: "Jane Doe",
        created_at: "2026-07-28T10:00:00Z",
      })
    ).toEqual({
      sessionId: "sess-1",
      arcId: "arc-1",
      topic: "Board pitch",
      speakerLabel: "Jane Doe",
      createdAt: "2026-07-28T10:00:00Z",
    });
  });

  it("drops a row with no session id — it could not open a labelling queue", () => {
    expect(mapTrainingImport({ topic: "x" })).toBeNull();
  });

  it("tolerates a missing speaker label — optional to the API, so the row still renders", () => {
    expect(
      mapTrainingImport({ session_id: "s", topic: "x" })?.speakerLabel
    ).toBeNull();
  });
});
