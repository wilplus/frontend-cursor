import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  trainingCorpus — the coach's corpus lane (2026-07-28)                      */
/*                                                                            */
/*  Import real human speech from outside the app, have it cut into pieces,    */
/*  and label each piece confident yes/no and how strongly. That corpus is     */
/*  what the confident-snippet recogniser trains on.                          */
/*                                                                            */
/*  COACH-ONLY, structurally (N4): this module is imported by exactly one      */
/*  surface, and trainingCorpusSeparation.test.ts enforces both directions —   */
/*  no user-lane file may import it, and it may not import the blind           */
/*  direction-labelling lane.                                                  */
/*                                                                            */
/*  The fences this lane exists inside:                                       */
/*                                                                            */
/*    N1 / BLIND COACH — the queue payload carries NO machine confidence read, */
/*      and this module adds none. There is no band, no score, nothing         */
/*      derivable from it. The composite picks WHO gets asked; the coach       */
/*      decides the answer. A visible hint would make every label a            */
/*      confirmation of the machine and the corpus circular.                   */
/*    N2 — the queue is band-shuffled server-side so position is not a tell.   */
/*      `fetchConfidenceQueue` returns it in payload order and nothing here    */
/*      sorts, groups or re-keys it.                                          */
/*    N3 — `confident` is required, `intensity` optional. buildLabelBody       */
/*      REFUSES to construct a body without a real boolean, so an intensity-   */
/*      only save (which would fabricate a confident value the coach never     */
/*      picked) cannot be built.                                              */
/*                                                                            */
/*  Nothing here touches the normal user's upload path (FE-4): that lane is    */
/*  `POST /v2/lab/recordings` and is untouched — no stages, no tick UI.        */
/* -------------------------------------------------------------------------- */

/** The analysis ticks (N5) — coach-only, never on the user's record flow.
 *  `confidence` is always on: it produces the transcript, the pieces, the
 *  acoustics and the label queue, i.e. the corpus itself. The other two are
 *  expensive and irrelevant to training. */
export const STAGE_CONFIDENCE = "confidence";
export const OPTIONAL_STAGES = ["analytics", "ideal_text"] as const;
export type OptionalStage = (typeof OPTIONAL_STAGES)[number];

/** One-line reason per optional tick — the cost the coach is choosing. */
export const STAGE_COST: Record<OptionalStage, string> = {
  analytics: "The advice layers. ~16 model calls per file — only for training the advice model.",
  ideal_text: "The assembled ideal text. A user deliverable, not training data.",
};

/* -------------------------------- language -------------------------------- */

/** What the coach can tell the import the audio is in.
 *
 *  `""` is AUTO-DETECT and is the default: it sends NO language field, so the
 *  request is byte-identical to what shipped before this existed. That matters
 *  while the BE has not confirmed it reads the field — the picker cannot break
 *  an import that works today, and a coach who ignores it changes nothing.
 *
 *  Codes are ISO-639-1, which is what Whisper takes. The list is curated, not
 *  exhaustive: Whisper knows ~99 languages, and a 99-item menu would bury the
 *  two that matter. Anything missing is a one-line addition here. */
export const IMPORT_LANGUAGES: { code: string; label: string }[] = [
  { code: "", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "pl", label: "Polish" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "uk", label: "Ukrainian" },
  { code: "cs", label: "Czech" },
  { code: "sv", label: "Swedish" },
];

const LANGUAGE_CODES = new Set(
  IMPORT_LANGUAGES.map((l) => l.code).filter((c) => c.length > 0)
);

/** Refuses anything not on the list rather than passing it through: an
 *  unrecognised code would either 400 upstream or, worse, be accepted and
 *  transcribe the talk as the wrong language. Auto-detect is the safe floor. */
export function normalizeLanguage(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const code = v.trim().toLowerCase();
  return LANGUAGE_CODES.has(code) ? code : null;
}

export interface ImportResult {
  sessionId: string;
  arcId: string;
  /** Pieces cut from the file. */
  snippetCount: number;
  /** Pieces queued for labelling. */
  queueCount: number;
  durationSec: number | null;
  speakerLabel: string | null;
  filename: string | null;
  /** The BE recognised the idempotency key and returned the ORIGINAL import
   *  instead of running a second analysis. A success, but not new work — and
   *  it must not read as one, or a coach re-importing a folder would believe
   *  thirty files were just processed. */
  duplicate: boolean;
}

/** Zero-piece reasons: the file was READ but nothing was cut. Distinct from a
 *  rejection (corrupt, too short) — nothing is wrong with the upload, so the
 *  screen shows these amber with the duration rather than red. */
const EMPTY_REASONS = new Set(["no_speech_detected", "no_candidates"]);

/** A failed import, with the BE's sentence kept verbatim: it explains a real
 *  content rejection in words worth showing, and inventing our own would hide
 *  which file to re-cut — or, on a zero-piece result, which knob to turn. */
export interface ImportFailure {
  ok: false;
  code: string | null;
  /** Machine reason, e.g. `NO_SPEECH_DETECTED`. NEVER rendered raw. */
  reason: string | null;
  /** The human sentence. `detail` in the current contract, `error` in the
   *  older one — both accepted so neither side has to deploy in lockstep. */
  error: string | null;
  /** Rides a zero-piece failure and is the whole diagnosis: a real length
   *  means the audio was read and transcription or cutting found nothing; a
   *  missing one means it was never decoded. */
  durationSec: number | null;
  /** The language the BE actually ran with, echoed back. */
  language: string | null;
  /** Read but empty, rather than rejected. Amber, not red. */
  empty: boolean;
  /** Present on a zero-piece result: the BE writes the session row anyway, so
   *  the attempt stays inspectable instead of living only in a response the
   *  coach already dismissed. */
  sessionId: string | null;
}

export type ImportOutcome = ({ ok: true } & ImportResult) | ImportFailure;

/** Both spellings of every field, because the two sides shipped different
 *  ones once already: the FE sent `idempotency_key` while the BE read
 *  `upload_idempotency_key`, so for a while the dedupe both sides believed in
 *  was not running at all. Reading a superset costs nothing and cannot drift. */
function mapFailure(body: Record<string, unknown> | null): ImportFailure {
  const reason = strOrNull(body?.reason);
  return {
    ok: false,
    code: strOrNull(body?.code),
    reason,
    error: strOrNull(body?.detail) ?? strOrNull(body?.error),
    durationSec: numOrNull(body?.duration_sec),
    language: strOrNull(body?.language),
    empty: reason !== null && EMPTY_REASONS.has(reason.toLowerCase()),
    sessionId: strOrNull(body?.session_id),
  };
}

function mapSuccess(body: Record<string, unknown>): { ok: true } & ImportResult {
  return {
    ok: true,
    sessionId: str(body.session_id),
    arcId: str(body.arc_id),
    snippetCount: count(body.snippet_count),
    queueCount: count(body.queue_count),
    durationSec: numOrNull(body.duration_sec),
    speakerLabel: strOrNull(body.speaker_label),
    filename: strOrNull(body.filename),
    duplicate: str(body.status).toLowerCase() === "duplicate",
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function count(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}
function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/* ---------------------------- idempotency key ----------------------------- */

/** Stable identity for ONE import attempt, so the BE can dedupe a retry.
 *
 *  The risk this exists for: the import runs Whisper inline for minutes, so a
 *  proxy/gateway timeout is likely on a long talk — and a timeout is NOT a
 *  failure. The BE very often finishes. The coach sees "failed", imports the
 *  same file again, and the corpus gets the same talk twice: labelled twice,
 *  training twice, with nothing on screen to say so. That is far worse than a
 *  failed upload, because it is invisible and it poisons the corpus.
 *
 *  So the key is DERIVED, not generated. A fresh uuid per attempt would be
 *  useless here — the retry is a NEW attempt by definition, and would get a
 *  new uuid and dedupe nothing. Deriving it from the file's identity plus the
 *  metadata it is being filed under means the same file re-picked from the
 *  same folder produces the same key, which is exactly the case that must
 *  collapse.
 *
 *  Identity is (name, size, lastModified) — not the file's CONTENT. Hashing
 *  the bytes would be stronger, but a folder of thirty 50MB talks would have
 *  to be read into memory twice, and name+size+mtime already identifies a
 *  file on disk to a degree this problem does not need to exceed. A rename
 *  therefore yields a new key; a re-import under a new topic or speaker does
 *  too, which is right — that is a deliberate second filing, not a retry. */
export async function importIdempotencyKey(input: {
  file: { name: string; size: number; lastModified: number };
  topic: string;
  speakerLabel?: string | null;
  language?: string | null;
}): Promise<string> {
  const seed = [
    input.file.name,
    String(input.file.size),
    String(input.file.lastModified),
    input.topic.trim(),
    (input.speakerLabel ?? "").trim(),
    // Language is PART OF THE KEY, and this is load-bearing rather than tidy.
    // The first thing a coach does after an import comes back empty is
    // re-import the same file with the language corrected. If the key ignored
    // language, that retry would be byte-identical to the failed English run,
    // a BE that dedupes would hand back the empty original, and the fix would
    // look like it did nothing. A different language is a different analysis.
    normalizeLanguage(input.language) ?? "",
  ].join("\u0000");

  // Hashed rather than sent raw so filenames do not end up in request logs.
  const subtle =
    typeof globalThis.crypto !== "undefined" ? globalThis.crypto.subtle : undefined;
  if (subtle) {
    try {
      const digest = await subtle.digest("SHA-256", new TextEncoder().encode(seed));
      return Array.from(new Uint8Array(digest))
        .slice(0, 16)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      // Fall through. A key we could not hash must never cost an upload.
    }
  }
  // Non-secure context (no subtle crypto): a deterministic non-crypto hash.
  // Weaker against collision, but this is a dedupe key, not a secret — and
  // being deterministic is the only property that actually matters.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    h1 = Math.imul(h1 ^ seed.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + seed.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

/** Import ONE file. One request per file is the contract, deliberately: a
 *  batch would block for minutes or need a job queue, while per-file requests
 *  give real progress and per-file failures. Callers fire a folder
 *  SEQUENTIALLY — the analysis is CPU-heavy and parallel mostly times out. */
export async function importTrainingAudio(input: {
  file: File;
  topic: string;
  speakerLabel?: string | null;
  userId?: string | null;
  note?: string | null;
  /** ISO-639-1, or null/"" for auto-detect (the field is then omitted). */
  language?: string | null;
  /** `confidence` is added here and cannot be omitted by a caller. */
  optionalStages?: OptionalStage[];
  queuePerBand?: number | null;
  signal?: AbortSignal;
  /** Fires once the BE has accepted the upload and named the session, before
   *  the analysis finishes — lets the screen say "analysing" against a real
   *  id rather than a spinner with nothing behind it. */
  onAccepted?: (sessionId: string) => void;
}): Promise<ImportOutcome> {
  const token = await getAuthToken();
  if (!token) return emptyFailure();
  const language = normalizeLanguage(input.language);
  const form = new FormData();
  form.append("audio_file", input.file);
  form.append("topic", input.topic);
  // OMITTED on auto-detect, not sent empty. Two reasons: an empty string is a
  // value a strict parser can reject, and leaving it out keeps the default
  // request byte-identical to what worked before the field existed — so the
  // picker cannot break an import for a coach who never touches it.
  if (language) form.append("language", language);
  // Sent as a form field rather than a header: the BFF re-emits this FormData
  // verbatim, so a field needs no proxy change, and every other import
  // parameter already travels this way.
  const key = await importIdempotencyKey({
    file: input.file,
    topic: input.topic,
    speakerLabel: input.speakerLabel,
    language,
  });
  // BOTH spellings, same value. The FE sent `idempotency_key` while the BE
  // read `upload_idempotency_key`, so for a stretch every key was dropped on
  // the floor and the duplicate protection both sides believed in was not
  // running at all — invisibly, because nothing about a silently-ignored field
  // looks wrong. The BE now accepts both; sending both means neither side can
  // reintroduce the mismatch by renaming one of them.
  form.append("idempotency_key", key);
  form.append("upload_idempotency_key", key);
  if (input.speakerLabel) form.append("speaker_label", input.speakerLabel);
  if (input.userId) form.append("user_id", input.userId);
  if (input.note) form.append("note", input.note);
  // The confidence stage is prepended, never taken from the caller — it is
  // what produces the corpus, so it is not the UI's to turn off.
  form.append(
    "stages",
    [STAGE_CONFIDENCE, ...(input.optionalStages ?? [])].join(",")
  );
  if (input.queuePerBand != null) {
    form.append("queue_per_band", String(input.queuePerBand));
  }

  let res: Response;
  try {
    res = await fetch("/api/v2/coach/training-imports", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
      signal: input.signal,
    });
  } catch {
    return emptyFailure();
  }
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!res.ok || !body) return mapFailure(body);
  // Terminal already? The BE returns 202 + a session id and the analysis runs
  // on, but a duplicate, a validation refusal and a zero-piece result all come
  // back complete. Deciding by SHAPE rather than by status code means neither
  // an older synchronous BE nor a newer async one needs the FE to be redeployed.
  const decided = terminalOutcome(body);
  if (decided) return decided;
  const sessionId = str(body.session_id);
  if (!sessionId) {
    // Neither finished nor pollable. Refusing to guess: reporting success here
    // would put a phantom row on screen for an import that may never exist.
    return mapFailure(body);
  }
  input.onAccepted?.(sessionId);
  return awaitImport(sessionId, token, input.signal);
}

/** Statuses that mean the analysis is over, in every spelling either side has
 *  used. Unknown values are treated as STILL RUNNING on purpose: polling a
 *  little longer costs a request, while calling an unfinished import finished
 *  reports a queue the coach cannot open. */
const DONE_STATUS = new Set(["complete", "completed", "done", "ready", "succeeded"]);
const FAILED_STATUS = new Set(["failed", "error", "errored", "cancelled", "canceled"]);

/** Reads a payload as a finished import, or null if it is still working.
 *  Exported for the tests — this is the whole async contract in one function. */
export function terminalOutcome(
  body: Record<string, unknown> | null
): ImportOutcome | null {
  if (!body) return null;
  if (body.ok === false) return mapFailure(body);
  const status = str(body.status || body.analysis_state).toLowerCase();
  if (FAILED_STATUS.has(status)) return mapFailure(body);
  if (status === "duplicate" || DONE_STATUS.has(status)) return mapSuccess(body);
  if (body.ok === true && status === "") {
    // `ok: true` with no status is the OLD synchronous shape, which always
    // carried counts. Without a count this is an acknowledgement, not a
    // result — and reading a bare `{ok, session_id}` as finished would render
    // it as a zero-piece import, i.e. announce a failure that never happened.
    return "snippet_count" in body || "queue_count" in body
      ? mapSuccess(body)
      : null;
  }
  return null;
}

/* -------------------------- waiting for the result ------------------------- */

/** Backed off rather than fixed. A short clip can be done in a second, so
 *  asking quickly at first keeps small imports feeling immediate; a 45-minute
 *  talk transcribes for minutes, and hammering a status endpoint for all of it
 *  buys nothing. The budget exists only so a BE that never reaches a terminal
 *  state cannot leave a row spinning forever. */
const POLL_BUDGET_MS = 30 * 60 * 1000;
function pollDelay(attempt: number): number {
  if (attempt === 0) return 1000;
  if (attempt === 1) return 2000;
  return attempt < 6 ? 4000 : 8000;
}

/** Poll until the import finishes. A network blip is NOT a failure — the
 *  analysis is still running server-side — so a failed poll waits and asks
 *  again rather than reporting an import dead that is about to succeed. */
async function awaitImport(
  sessionId: string,
  token: string,
  signal?: AbortSignal
): Promise<ImportOutcome> {
  const deadline = Date.now() + POLL_BUDGET_MS;
  for (let attempt = 0; ; attempt++) {
    await sleep(pollDelay(attempt), signal);
    if (signal?.aborted) {
      return { ...emptyFailure(), sessionId, error: null };
    }
    let res: Response;
    try {
      res = await fetch(
        `/api/v2/coach/training-imports/${encodeURIComponent(sessionId)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal }
      );
    } catch {
      if (Date.now() > deadline) break;
      continue;
    }
    const body = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (res.ok && body) {
      const decided = terminalOutcome(body);
      if (decided) return decided;
    } else if (res.status >= 400 && res.status !== 404 && res.status < 500) {
      // A 4xx that is not "not yet" is the BE refusing, not a hiccup.
      return { ...mapFailure(body), sessionId };
    }
    if (Date.now() > deadline) break;
  }
  return {
    ...emptyFailure(),
    sessionId,
    code: "IMPORT_TIMED_OUT",
    error:
      "Still analysing after 30 minutes. The import may still finish — check the list below before importing it again.",
  };
}

function emptyFailure(): ImportFailure {
  return {
    ok: false,
    code: null,
    reason: null,
    error: null,
    durationSec: null,
    language: null,
    empty: false,
    sessionId: null,
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}

/* --------------------------------- index ---------------------------------- */

export interface TrainingImport {
  sessionId: string;
  arcId: string | null;
  topic: string;
  speakerLabel: string | null;
  createdAt: string | null;
  /** `running` | `done` | `failed`. Normalised from the BE's `status` or
   *  `analysis_state`, and defaulted to `done` when NEITHER is present: an
   *  older payload that predates the field must keep opening, not become an
   *  index of rows that all claim to be working. */
  state: "running" | "done" | "failed";
  /** Pieces waiting to be labelled, when the BE knows. Null on an older
   *  payload — which is why the row says nothing rather than "0 to label". */
  queueCount: number | null;
  /** Why a failed import failed, in the BE's words. */
  detail: string | null;
}

export function mapTrainingImport(raw: unknown): TrainingImport | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sessionId = str(r.session_id);
  // No session id = no labelling queue to open, so the row is a dead end.
  if (!sessionId) return null;
  const status = str(r.status || r.analysis_state).toLowerCase();
  return {
    sessionId,
    arcId: strOrNull(r.arc_id),
    topic: str(r.topic),
    speakerLabel: strOrNull(r.speaker_label),
    createdAt: strOrNull(r.created_at),
    state: FAILED_STATUS.has(status)
      ? "failed"
      : status === "" || DONE_STATUS.has(status)
        ? "done"
        : "running",
    queueCount: numOrNull(r.queue_count),
    detail: strOrNull(r.detail) ?? strOrNull(r.analysis_error) ?? strOrNull(r.error),
  };
}

/** The corpus index. Soft-fails to null (the screen shows a retry line);
 *  an empty list is a valid state, not an error. */
export async function fetchTrainingImports(
  userId?: string | null
): Promise<TrainingImport[] | null> {
  const token = await getAuthToken();
  if (!token) return null;
  const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
  let res: Response;
  try {
    res = await fetch(`/api/v2/coach/training-imports${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || !Array.isArray(body.imports)) return null;
  return body.imports
    .map(mapTrainingImport)
    .filter((i): i is TrainingImport => i !== null);
}

/* ------------------------------ the queue --------------------------------- */

/** The coach's own prior call on a piece. */
export interface ConfidenceLabel {
  confident: boolean;
  /** 1–5, or null when the coach answered yes/no without grading it. */
  intensity: number | null;
  /** The coach's own aside — "hard to call", "background noise". Kept so a
   *  saved note re-renders when the coach steps back to a piece, rather than
   *  looking as if it never saved. */
  note: string | null;
}

export interface QueuePiece {
  snippetId: string;
  transcript: string;
  audioRef: string | null;
  startOffsetMs: number;
  durationMs: number;
  label: ConfidenceLabel | null;
}

export interface ConfidenceQueue {
  sessionId: string;
  /** Payload order, preserved (N2). */
  queue: QueuePiece[];
}

/** 1–5, matching the research this is anchored to, so the numbers stay
 *  comparable to published data. Anything else is dropped rather than
 *  clamped — a clamped 9 would silently become a 5 the coach never picked. */
export const INTENSITY_MIN = 1;
export const INTENSITY_MAX = 5;

function pickIntensity(v: unknown): number | null {
  return typeof v === "number" &&
    Number.isInteger(v) &&
    v >= INTENSITY_MIN &&
    v <= INTENSITY_MAX
    ? v
    : null;
}

function pickLabel(raw: unknown): ConfidenceLabel | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  // Only a real boolean counts as a prior call — anything else means this
  // piece is still unlabelled, which is the safe reading (it gets asked again
  // rather than showing a label the coach never gave).
  if (typeof r.confident !== "boolean") return null;
  return {
    confident: r.confident,
    intensity: pickIntensity(r.intensity),
    note: strOrNull(r.note),
  };
}

export function mapQueuePiece(raw: unknown): QueuePiece | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const snippetId = str(r.snippet_id);
  const transcript = str(r.transcript);
  // No id = the label PUT has nowhere to go. No transcript = nothing to read
  // alongside the audio. Either way the piece is unjudgeable — dropped, not
  // repaired.
  if (!snippetId || !transcript) return null;
  return {
    snippetId,
    transcript,
    audioRef: strOrNull(r.audio_ref),
    startOffsetMs: count(r.start_offset_ms),
    durationMs: count(r.duration_ms),
    label: pickLabel(r.label),
  };
}

export function mapConfidenceQueue(raw: unknown): ConfidenceQueue | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.queue)) return null;
  return {
    sessionId: str(r.session_id),
    // Payload order kept verbatim (N2): the queue is band-shuffled so that
    // position is not a tell, and re-sorting here would rebuild the tell.
    queue: r.queue.map(mapQueuePiece).filter((p): p is QueuePiece => p !== null),
  };
}

export async function fetchConfidenceQueue(
  sessionId: string
): Promise<ConfidenceQueue | null> {
  const token = await getAuthToken();
  if (!token) return null;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/confidence-queue`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as unknown;
  return mapConfidenceQueue(body);
}

/* ------------------------------ the label --------------------------------- */

export interface ConfidenceLabelBody {
  confident: boolean;
  intensity?: number;
  note?: string;
}

/** Build the label PUT body — the ONE constructor for a label write.
 *
 *  N3 lives here rather than in a submit handler: `confident` must be a real
 *  boolean, so a body carrying an intensity with no answer — which would
 *  fabricate training data the coach never gave — cannot be constructed at
 *  all. An out-of-range intensity is DROPPED, not clamped, for the same
 *  reason: a clamped 9 would silently become a 5 nobody picked. */
export function buildLabelBody(
  confident: unknown,
  intensity?: unknown,
  note?: string | null
): ConfidenceLabelBody | null {
  if (typeof confident !== "boolean") return null;
  const body: ConfidenceLabelBody = { confident };
  const graded = pickIntensity(intensity);
  if (graded !== null) body.intensity = graded;
  const trimmed = note?.trim() ?? "";
  if (trimmed) body.note = trimmed;
  return body;
}

export type SaveLabelResult = { ok: true } | { ok: false; error: string | null };

/** Save one label (re-labelling replaces this coach's call; other raters'
 *  labels are untouched). Never throws; the caller shows `error` inline —
 *  the BE's 400 is verbatim-safe and its 500 names the missing migration. */
export async function saveConfidenceLabel(
  snippetId: string,
  body: ConfidenceLabelBody
): Promise<SaveLabelResult> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: null };
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/snippets/${encodeURIComponent(snippetId)}/confidence-label`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );
  } catch {
    return { ok: false, error: null };
  }
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  return { ok: false, error: strOrNull(data?.error) };
}
