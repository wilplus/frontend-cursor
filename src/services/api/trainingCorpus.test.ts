import { describe, expect, it } from "vitest";
import {
  buildLabelBody,
  IMPORT_LANGUAGES,
  importIdempotencyKey,
  normalizeLanguage,
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

describe("importIdempotencyKey", () => {
  const file = { name: "board-pitch.mp3", size: 51_200_000, lastModified: 1_753_600_000_000 };
  const base = { file, topic: "Board pitch", speakerLabel: "Jane Doe" };

  it("gives the SAME key to a retry of the same file — the entire point, since a timeout is not a failure and the coach will press Import again", async () => {
    expect(await importIdempotencyKey(base)).toBe(await importIdempotencyKey(base));
    // A distinct object with equal values is still the same file re-picked
    // from the same folder, which is exactly the retry that must collapse.
    expect(await importIdempotencyKey({ ...base, file: { ...file } })).toBe(
      await importIdempotencyKey(base)
    );
  });

  it("separates two different files in one batch, including same-name-different-size", async () => {
    const k = await importIdempotencyKey(base);
    expect(await importIdempotencyKey({ ...base, file: { ...file, name: "keynote.mp3" } })).not.toBe(k);
    expect(await importIdempotencyKey({ ...base, file: { ...file, size: 51_200_001 } })).not.toBe(k);
    expect(await importIdempotencyKey({ ...base, file: { ...file, lastModified: 1 } })).not.toBe(k);
  });

  it("re-filing the same audio under a new topic or speaker is a deliberate second import, not a retry", async () => {
    const k = await importIdempotencyKey(base);
    expect(await importIdempotencyKey({ ...base, topic: "Keynote" })).not.toBe(k);
    expect(await importIdempotencyKey({ ...base, speakerLabel: "John Roe" })).not.toBe(k);
  });

  it("ignores whitespace the coach typed around the topic — otherwise a stray space defeats the dedupe", async () => {
    expect(await importIdempotencyKey({ ...base, topic: "  Board pitch " })).toBe(
      await importIdempotencyKey(base)
    );
  });

  it("treats a missing speaker and an empty speaker as the same filing", async () => {
    const omitted = await importIdempotencyKey({ file, topic: "Board pitch" });
    expect(await importIdempotencyKey({ file, topic: "Board pitch", speakerLabel: null })).toBe(omitted);
    expect(await importIdempotencyKey({ file, topic: "Board pitch", speakerLabel: "  " })).toBe(omitted);
  });

  it("cannot be confused by a field boundary — the delimiter is one that cannot occur in a filename", async () => {
    // Without a NUL delimiter, ("ab", "c") and ("a", "bc") would concatenate
    // identically and two different files would share a key.
    expect(
      await importIdempotencyKey({ file: { ...file, name: "ab" }, topic: "c" })
    ).not.toBe(
      await importIdempotencyKey({ file: { ...file, name: "a" }, topic: "bc" })
    );
  });

  it("CHANGES with the language — otherwise re-importing with the language corrected would dedupe against the empty English run and look like it did nothing", async () => {
    const auto = await importIdempotencyKey(base);
    const pl = await importIdempotencyKey({ ...base, language: "pl" });
    const en = await importIdempotencyKey({ ...base, language: "en" });
    expect(pl).not.toBe(auto);
    expect(pl).not.toBe(en);
    // …but the same language is still the same attempt.
    expect(await importIdempotencyKey({ ...base, language: "pl" })).toBe(pl);
  });

  it("treats auto-detect, absent and an unknown code as the same attempt — an unknown code is not sent, so it cannot be what distinguishes one", async () => {
    const auto = await importIdempotencyKey(base);
    expect(await importIdempotencyKey({ ...base, language: "" })).toBe(auto);
    expect(await importIdempotencyKey({ ...base, language: null })).toBe(auto);
    expect(await importIdempotencyKey({ ...base, language: "klingon" })).toBe(auto);
  });

  it("is a plain hex token — safe in a form field and carries no filename into request logs", async () => {
    const k = await importIdempotencyKey(base);
    expect(k).toMatch(/^[0-9a-f]{16,}$/);
    expect(k).not.toContain("board-pitch");
  });

  it("still returns a stable key with no subtle crypto — a non-secure context must not lose dedupe", async () => {
    const real = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
      const a = await importIdempotencyKey(base);
      const b = await importIdempotencyKey({ ...base, file: { ...file } });
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{16}$/);
      expect(await importIdempotencyKey({ ...base, topic: "Keynote" })).not.toBe(a);
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: real, configurable: true });
    }
  });

  it("never throws when the hash itself fails — a key we cannot compute must not cost an upload", async () => {
    const real = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, "crypto", {
        value: { subtle: { digest: () => Promise.reject(new Error("no")) } },
        configurable: true,
      });
      await expect(importIdempotencyKey(base)).resolves.toMatch(/^[0-9a-f]{16}$/);
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: real, configurable: true });
    }
  });
});

describe("normalizeLanguage", () => {
  it("accepts a code that is actually on the menu", () => {
    expect(normalizeLanguage("pl")).toBe("pl");
    expect(normalizeLanguage("EN")).toBe("en");
    expect(normalizeLanguage(" uk ")).toBe("uk");
  });

  it("refuses anything else rather than passing it through — an unrecognised code either 400s upstream or, worse, transcribes the talk as the wrong language", () => {
    for (const bad of ["", "klingon", "pl-PL", "polish", "xx", null, 5, undefined]) {
      expect(normalizeLanguage(bad)).toBeNull();
    }
  });

  it("offers auto-detect FIRST and as the empty code, so the default omits the field entirely", () => {
    expect(IMPORT_LANGUAGES[0]).toEqual({ code: "", label: "Auto-detect" });
    expect(normalizeLanguage(IMPORT_LANGUAGES[0].code)).toBeNull();
  });

  it("every offered code is one normalizeLanguage will actually send — a menu entry that got dropped would silently do nothing", () => {
    for (const l of IMPORT_LANGUAGES.slice(1)) {
      expect(normalizeLanguage(l.code)).toBe(l.code);
    }
    expect(IMPORT_LANGUAGES.map((l) => l.code)).toContain("pl");
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
