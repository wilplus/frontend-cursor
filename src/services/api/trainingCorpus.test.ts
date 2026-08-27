import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES } from "@/components/willab/audioUploadValidation";
import {
  exceedsProxyLimit,
  IMPORT_LANGUAGES,
  languageLabel,
  normalizeSpeakerSex,
  SPEAKER_SEXES,
  importIdempotencyKey,
  normalizeLanguage,
  mapConfidenceQueue,
  mapQueuePiece,
  mapTrainingImport,
  terminalOutcome,
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
      reReview: false,
      learningExposures: [],
    });
  });

  it("maps only production render-ACK handles for a blind row", () => {
    const mapped = mapQueuePiece(piece({
      learning_exposures: [{
        presentation_id: "11111111-1111-4111-8111-111111111111",
        acknowledgement_token: "22222222-2222-4222-8222-222222222222",
        learning_surface: "confidence_classification",
        evaluation_only: false,
      }, {
        presentation_id: "33333333-3333-4333-8333-333333333333",
        acknowledgement_token: "44444444-4444-4444-8444-444444444444",
        learning_surface: "confidence_classification",
        evaluation_only: true,
      }],
    }));
    expect(mapped?.learningExposures).toEqual([{
      presentationId: "11111111-1111-4111-8111-111111111111",
      acknowledgementToken: "22222222-2222-4222-8222-222222222222",
      learningSurface: "confidence_classification",
    }]);
  });

  it("drops a row with no snippet id — the label PUT would have nowhere to go", () => {
    expect(mapQueuePiece(piece({ snippet_id: "" }))).toBeNull();
  });

  it("keeps the server-redacted pre-judgment row for audio-only blind review", () => {
    expect(mapQueuePiece(piece({ transcript: "" }))?.transcript).toBe("");
  });

  it("keeps this coach's prior call, HISTORICAL intensity included — the 1–5 row is cut (2026-08-11) but rows graded before the cut must read back faithfully", () => {
    const m = mapQueuePiece(
      piece({ label: { confident: true, intensity: 4, note: "hard to call" } })
    );
    expect(m?.label).toEqual({
      value: "yes",
      unrateable: false,
      confident: true,
      intensity: 4,
      note: "hard to call",
    });
  });

  it("keeps a yes/no call that was never graded", () => {
    expect(
      mapQueuePiece(piece({ label: { confident: false } }))?.label
    ).toEqual({
      value: "no",
      unrateable: false,
      confident: false,
      intensity: null,
      note: null,
    });
  });

  it("a stored v1 neutral reads back as v2 not-sure — never re-asked", () => {
    // v1 neutral meant IDK. Preserve that meaning instead of silently
    // relabeling the historical answer as v2's perceptual middle.
    expect(
      mapQueuePiece(piece({ label: { value: "neutral" } }))?.label
    ).toEqual({
      value: "not_sure",
      unrateable: false,
      confident: null,
      intensity: null,
      note: null,
    });
  });

  it("an abstention (unrateable) reads back as a label too — a statement about the rater, not an unanswered row", () => {
    expect(
      mapQueuePiece(piece({ label: { unrateable: true } }))?.label
    ).toEqual({
      value: null,
      unrateable: true,
      confident: null,
      intensity: null,
      note: null,
    });
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

// The label-body constructor tests moved with the constructor: N3 now lives
// in stateRatings.ts (buildRatingBody) and is pinned in stateRatings.test.ts.
// The binary + 1–5 builder that was tested here was cut with the intensity
// row (founder 2026-08-11).

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

describe("terminalOutcome — the async import contract", () => {
  it("treats a 202-style acceptance as STILL RUNNING, so the screen polls instead of claiming a queue", () => {
    expect(terminalOutcome({ session_id: "s", status: "processing" })).toBeNull();
    expect(terminalOutcome({ session_id: "s", analysis_state: "running" })).toBeNull();
    expect(terminalOutcome({ session_id: "s" })).toBeNull();
    expect(terminalOutcome(null)).toBeNull();
  });

  it("treats an UNKNOWN status as still running — polling a little longer costs a request, while calling an unfinished import finished shows a queue that cannot open", () => {
    expect(terminalOutcome({ session_id: "s", status: "reticulating" })).toBeNull();
  });

  it("does NOT read a bare {ok, session_id} acknowledgement as a finished import — with no counts it would render as a zero-piece result and announce a failure that never happened", () => {
    expect(terminalOutcome({ ok: true, session_id: "s" })).toBeNull();
    // A count is the evidence that this is a result rather than a receipt.
    expect(terminalOutcome({ ok: true, session_id: "s", queue_count: 0 })?.ok).toBe(true);
  });

  it("reads the finished shapes, in every spelling", () => {
    for (const status of ["complete", "completed", "done", "ready", "succeeded"]) {
      const r = terminalOutcome({ status, session_id: "s", arc_id: "a", snippet_count: 42 });
      expect(r?.ok).toBe(true);
    }
    // The older synchronous BE answered ok:true with no status at all — but
    // always with counts, which is what marks it a result.
    expect(terminalOutcome({ ok: true, session_id: "s", snippet_count: 42 })?.ok).toBe(true);
  });

  it("reads a zero-piece result as a FAILURE that was read, not a rejection — and keeps the duration that diagnoses it", () => {
    const r = terminalOutcome({
      ok: false,
      reason: "NO_SPEECH_DETECTED",
      detail: "the transcript was empty — if this audio is not in English, re-import it with a `language` code (e.g. pl)",
      session_id: "sess-9",
      duration_sec: 2480,
      language: "pl",
    });
    expect(r?.ok).toBe(false);
    if (r?.ok === false) {
      expect(r.empty).toBe(true);
      expect(r.durationSec).toBe(2480);
      expect(r.language).toBe("pl");
      expect(r.sessionId).toBe("sess-9");
      // `detail` is the sentence; the raw enum must never be what gets shown.
      expect(r.error).toContain("re-import it with a");
    }
  });

  it("NO_CANDIDATES is also read-but-empty — the audio was fine, the cutter just found nothing", () => {
    const r = terminalOutcome({ ok: false, reason: "NO_CANDIDATES", duration_sec: 300 });
    expect(r?.ok === false && r.empty).toBe(true);
  });

  it("a real rejection is NOT empty — nothing was read, so it is red rather than amber", () => {
    const r = terminalOutcome({ ok: false, reason: "too_short", error: "That clip is too short to analyse." });
    expect(r?.ok === false && r.empty).toBe(false);
    expect(r?.ok === false && r.error).toBe("That clip is too short to analyse.");
  });

  it("still reads the older `error` field when `detail` is absent, so neither side has to deploy in lockstep", () => {
    const r = terminalOutcome({ ok: false, error: "old shape" });
    expect(r?.ok === false && r.error).toBe("old shape");
  });

  it("a failed status is terminal even without ok:false — otherwise a dead import polls for thirty minutes", () => {
    for (const status of ["failed", "error", "cancelled"]) {
      expect(terminalOutcome({ status, session_id: "s" })?.ok).toBe(false);
    }
  });

  it("flags a duplicate so 'it succeeded' and 'it was already done' can read differently", () => {
    const r = terminalOutcome({
      ok: true,
      status: "duplicate",
      session_id: "sess-1",
      arc_id: "arc-1",
      queue_count: 15,
    });
    expect(r?.ok === true && r.duplicate).toBe(true);
    expect(r?.ok === true && r.queueCount).toBe(15);
    // A normal success is not a duplicate.
    expect(
      terminalOutcome({ ok: true, session_id: "s", snippet_count: 1 })?.ok === true &&
        (terminalOutcome({ ok: true, session_id: "s", snippet_count: 1 }) as { duplicate: boolean }).duplicate
    ).toBe(false);
  });
});

describe("mapTrainingImport — the index row's state", () => {
  it("defaults to done when the BE sends no status — an older payload must keep opening, not read as an index of rows all still working", () => {
    expect(mapTrainingImport({ session_id: "s" })?.state).toBe("done");
  });

  it("marks a running import so a finished one and an in-flight one stop looking identical", () => {
    expect(mapTrainingImport({ session_id: "s", status: "processing" })?.state).toBe("running");
    expect(mapTrainingImport({ session_id: "s", analysis_state: "running" })?.state).toBe("running");
  });

  it("keeps a failed row WITH its reason — the row is the evidence for why a file produced nothing", () => {
    const r = mapTrainingImport({
      session_id: "s",
      analysis_state: "failed",
      analysis_error: "the transcript was empty",
    });
    expect(r?.state).toBe("failed");
    expect(r?.detail).toBe("the transcript was empty");
  });

  it("shows what an import RAN AS when the list carries it, and stays null otherwise — on a row whose transcript reads oddly, that null is the answer", () => {
    expect(mapTrainingImport({ session_id: "s", language: "pl" })?.language).toBe("pl");
    expect(mapTrainingImport({ session_id: "s" })?.language).toBeNull();
  });

  it("carries queue_count, and leaves it null when the BE does not send one — so an older payload says nothing rather than '0 to label'", () => {
    expect(mapTrainingImport({ session_id: "s", queue_count: 15 })?.queueCount).toBe(15);
    expect(mapTrainingImport({ session_id: "s" })?.queueCount).toBeNull();
  });
});

describe("exceedsProxyLimit — the 413 that killed the first real import", () => {
  it("passes anything the same-origin hop can actually carry", () => {
    expect(exceedsProxyLimit(0)).toBe(false);
    expect(exceedsProxyLimit(4 * 1024 * 1024)).toBe(false);
  });

  it("flags a real talk — a 41-minute mp3 is ~40 MB against a ~4.5 MB request-body cap, which is why the first import came back 413", () => {
    expect(exceedsProxyLimit(40 * 1024 * 1024)).toBe(true);
    expect(exceedsProxyLimit(4.5 * 1024 * 1024 + 1)).toBe(true);
  });

  it("uses the SAME constant as every other upload picker in the app, so the number cannot drift in one place", () => {
    expect(exceedsProxyLimit(MAX_UPLOAD_BYTES)).toBe(false);
    expect(exceedsProxyLimit(MAX_UPLOAD_BYTES + 1)).toBe(true);
  });
});

describe("speaker sex — the analysis routes on it, so it is validated like the language code", () => {
  it("accepts only the three values the BE knows", () => {
    expect(normalizeSpeakerSex("female")).toBe("female");
    expect(normalizeSpeakerSex("MALE")).toBe("male");
    expect(normalizeSpeakerSex("prefer_not_to_say")).toBe("prefer_not_to_say");
  });

  it("refuses anything else rather than forwarding it — a value the BE does not know either 400s or routes the cue the wrong way", () => {
    for (const bad of ["", "f", "m", "woman", "other", null, 1, undefined]) {
      expect(normalizeSpeakerSex(bad)).toBeNull();
    }
  });

  it("offers 'not stated' first and as the empty value, so the field is omitted unless the coach says something", () => {
    expect(SPEAKER_SEXES[0].value).toBe("");
    expect(normalizeSpeakerSex(SPEAKER_SEXES[0].value)).toBeNull();
  });

  it("CHANGES the idempotency key — it changes the analysis, so correcting it must re-run rather than dedupe into the wrong route", async () => {
    const f = { name: "t.mp3", size: 10, lastModified: 1 };
    const base = { file: f, topic: "T" };
    const none = await importIdempotencyKey(base);
    const female = await importIdempotencyKey({ ...base, speakerSex: "female" });
    expect(female).not.toBe(none);
    expect(await importIdempotencyKey({ ...base, speakerSex: "male" })).not.toBe(female);
    // An unknown value is not sent, so it cannot be what distinguishes a run.
    expect(await importIdempotencyKey({ ...base, speakerSex: "woman" })).toBe(none);
  });
});

describe("languageLabel", () => {
  it("turns the echoed code into the word on the row", () => {
    expect(languageLabel("pl")).toBe("Polish");
    expect(languageLabel("en")).toBe("English");
  });

  it("is empty for auto-detect, so the caller decides what 'no language' reads as", () => {
    expect(languageLabel(null)).toBe("");
    expect(languageLabel("")).toBe("");
  });

  it("passes an unknown code straight through rather than hiding it — seeing 'sw' beats seeing nothing when a transcript reads oddly", () => {
    expect(languageLabel("sw")).toBe("sw");
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

  it("offers auto-detect FIRST and as the empty code — the panel makes choosing it deliberate, but the code still omits the field", () => {
    expect(IMPORT_LANGUAGES[0]).toEqual({ code: "", label: "Auto-detect" });
    expect(normalizeLanguage(IMPORT_LANGUAGES[0].code)).toBeNull();
  });

  it("every offered code is one normalizeLanguage will actually send — a menu entry that got dropped would silently do nothing", () => {
    for (const l of IMPORT_LANGUAGES.slice(1)) {
      expect(normalizeLanguage(l.code)).toBe(l.code);
    }
    // Polish leads the real codes: it is what this corpus is actually made of,
    // and the language that was silently mistranslated.
    expect(IMPORT_LANGUAGES[1].code).toBe("pl");
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
      state: "done",
      queueCount: null,
      detail: null,
      language: null,
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
