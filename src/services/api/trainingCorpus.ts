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
}

/** A failed import, with the reason kept verbatim: the BE's 422 explains a
 *  real content rejection (silence, corrupt, too short) in words worth
 *  showing, and inventing our own would hide which file to re-cut. */
export interface ImportFailure {
  ok: false;
  code: string | null;
  reason: string | null;
  error: string | null;
}

export type ImportOutcome = ({ ok: true } & ImportResult) | ImportFailure;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function count(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
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
  /** `confidence` is added here and cannot be omitted by a caller. */
  optionalStages?: OptionalStage[];
  queuePerBand?: number | null;
  signal?: AbortSignal;
}): Promise<ImportOutcome> {
  const token = await getAuthToken();
  if (!token) {
    return { ok: false, code: null, reason: null, error: null };
  }
  const form = new FormData();
  form.append("audio_file", input.file);
  form.append("topic", input.topic);
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
    return { ok: false, code: null, reason: null, error: null };
  }
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!res.ok || !body || body.ok !== true) {
    return {
      ok: false,
      code: strOrNull(body?.code),
      reason: strOrNull(body?.reason),
      error: strOrNull(body?.error),
    };
  }
  return {
    ok: true,
    sessionId: str(body.session_id),
    arcId: str(body.arc_id),
    snippetCount: count(body.snippet_count),
    queueCount: count(body.queue_count),
    durationSec:
      typeof body.duration_sec === "number" && Number.isFinite(body.duration_sec)
        ? body.duration_sec
        : null,
    speakerLabel: strOrNull(body.speaker_label),
    filename: strOrNull(body.filename),
  };
}

/* --------------------------------- index ---------------------------------- */

export interface TrainingImport {
  sessionId: string;
  arcId: string | null;
  topic: string;
  speakerLabel: string | null;
  createdAt: string | null;
}

export function mapTrainingImport(raw: unknown): TrainingImport | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sessionId = str(r.session_id);
  // No session id = no labelling queue to open, so the row is a dead end.
  if (!sessionId) return null;
  return {
    sessionId,
    arcId: strOrNull(r.arc_id),
    topic: str(r.topic),
    speakerLabel: strOrNull(r.speaker_label),
    createdAt: strOrNull(r.created_at),
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
  return { confident: r.confident, intensity: pickIntensity(r.intensity) };
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
