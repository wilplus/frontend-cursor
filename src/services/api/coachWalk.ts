/* -------------------------------------------------------------------------- */
/*  The coach's walk — the two reads it adds (founder 2026-09-30; P2-8, P2-10). */
/*                                                                            */
/*    GET /api/v2/coach/queue/moments                → the queue of moments    */
/*    GET /api/v2/coach/sessions/:sid/snippets/:snip/moment → the Read screen  */
/*                                                                            */
/*  The rating itself goes through saveStateRating (stateRatings.ts) and the   */
/*  coach's answer through answerCoachExerciseRequest: nothing new is written  */
/*  from here. Both reads soft-fail: the queue draws empty, the Read screen    */
/*  says it could not read, and neither ever throws into a sheet.             */
/* -------------------------------------------------------------------------- */

import { isAnswer, mapMomentsQueue, type AnswerValue, type QueueSpeaker } from "@/lib/willab/coachWalk";
import { mapCoachExerciseRequest, type CoachExerciseRequest } from "./coachExerciseRequest";

export type MomentsQueueResult =
  | { ok: true; speakers: QueueSpeaker[] }
  | { ok: false; code: "RATER_LANGUAGES_REQUIRED" | "FORBIDDEN" | "UNAVAILABLE" };

export async function fetchMomentsQueue(): Promise<MomentsQueueResult> {
  let res: Response;
  try {
    res = await fetch("/api/v2/coach/queue/moments", {
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
  if (res.status === 428) return { ok: false, code: "RATER_LANGUAGES_REQUIRED" };
  if (res.status === 401 || res.status === 403) return { ok: false, code: "FORBIDDEN" };
  if (!res.ok) return { ok: false, code: "UNAVAILABLE" };
  const data = await res.json().catch(() => null);
  return { ok: true, speakers: mapMomentsQueue(data) };
}

export interface MomentRead {
  passage: string;
  speakerAnswer: AnswerValue | null;
  coachAnswer: AnswerValue | null;
  speakerGoal: string | null;
  /** null when nothing reached the coach from this moment. */
  request: CoachExerciseRequest | null;
  namedErrors: string[];
}

export function mapMomentRead(raw: unknown): MomentRead | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    passage: typeof r.passage === "string" ? r.passage : "",
    speakerAnswer: isAnswer(r.speaker_answer) ? r.speaker_answer : null,
    coachAnswer: isAnswer(r.coach_answer) ? r.coach_answer : null,
    speakerGoal: typeof r.speaker_goal === "string" && r.speaker_goal ? r.speaker_goal : null,
    request: mapCoachExerciseRequest(r.request),
    namedErrors: Array.isArray(r.named_errors)
      ? r.named_errors.filter((e): e is string => typeof e === "string")
      : [],
  };
}

/** The Read screen's one source, after the coach's own rating. null on the
 *  blind gate (409), on a missing moment, or on any failure. */
export async function fetchMomentRead(
  sessionId: string,
  snippetId: string,
): Promise<MomentRead | null> {
  try {
    const res = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/moment`,
      { credentials: "include", cache: "no-store" },
    );
    if (!res.ok) return null;
    return mapMomentRead(await res.json().catch(() => null));
  } catch {
    return null;
  }
}

/* ── screens 4 to 7 (group 4) ─────────────────────────────────────────── */

export type DraftSurface = "exercise_script" | "praise_line" | "clearer_version";

export interface RequestDraft {
  surface: DraftSurface;
  text: string;
  modelVersion: string | null;
}

/** POST …/exercise-request/draft: one model draft by the request's kind,
 *  coach-only. null on 409 (an ambiguity, a resolved request, no passage),
 *  on 503 (no provider answer) or on any failure: the coach writes by hand. */
export async function draftForRequest(
  sessionId: string,
  snippetId: string,
  notes?: string,
): Promise<RequestDraft | null> {
  try {
    const res = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/exercise-request/draft`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notes?.trim() ? { notes: notes.trim() } : {}),
      },
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    const draft = (data?.draft ?? null) as Record<string, unknown> | null;
    if (!draft || typeof draft.text !== "string" || !draft.text.trim()) return null;
    const surface = draft.surface;
    if (surface !== "exercise_script" && surface !== "praise_line" && surface !== "clearer_version") {
      return null;
    }
    return {
      surface,
      text: draft.text,
      modelVersion: typeof draft.model_version === "string" ? draft.model_version : null,
    };
  } catch {
    return null;
  }
}

/** POST …/exercise-request/video (multipart): the video a coach adds to a
 *  written answer. Returns its playable address, or the refusal's sentence. */
export async function uploadAnswerVideo(
  sessionId: string,
  snippetId: string,
  file: File,
): Promise<{ ok: true; videoUrl: string } | { ok: false; message: string }> {
  const form = new FormData();
  form.append("video_file", file, file.name || "answer.webm");
  try {
    const res = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/exercise-request/video`,
      { method: "POST", credentials: "include", body: form },
    );
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!res.ok || typeof data?.video_url !== "string") {
      return { ok: false, message: typeof data?.error === "string" ? data.error : "Couldn’t upload the video." };
    }
    return { ok: true, videoUrl: data.video_url };
  } catch {
    return { ok: false, message: "Couldn’t upload the video." };
  }
}

export type WordsResolution = "line_written" | "version_written" | "note_written";

/** PUT …/exercise-request with an answer in words (0402, 0403). */
export async function answerInWords(
  sessionId: string,
  snippetId: string,
  input: {
    resolution: WordsResolution;
    answerText: string;
    share: boolean;
    /** praise only: false keeps the line to this speaker, off the catalogue. */
    fileInCatalogue?: boolean;
    /** the coach's own pattern choice: a cue, "confident_read", or a move. */
    patternKey?: string | null;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const body: Record<string, unknown> = {
    resolution: input.resolution,
    answer_text: input.answerText,
    share_with_user: input.share,
  };
  if (input.fileInCatalogue === false) body.file_in_catalogue = false;
  if (input.patternKey) body.pattern_key = input.patternKey;
  try {
    const res = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/exercise-request`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    return { ok: false, message: typeof data?.error === "string" ? data.error : "Couldn’t save your answer." };
  } catch {
    return { ok: false, message: "Couldn’t save your answer." };
  }
}

export interface TakeWord {
  text: string | null;
  videoUrl: string | null;
  videoRef: string | null;
  sharedAt: string | null;
}

function mapTakeWord(raw: unknown): TakeWord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    text: typeof r.text === "string" && r.text ? r.text : null,
    videoUrl: typeof r.video_url === "string" && r.video_url ? r.video_url : null,
    videoRef: typeof r.video_ref === "string" && r.video_ref ? r.video_ref : null,
    sharedAt: typeof r.shared_at === "string" ? r.shared_at : null,
  };
}

/** GET …/word: this coach's own word for the Take, or null. */
export async function fetchTakeWord(sessionId: string): Promise<TakeWord | null> {
  try {
    const res = await fetch(`/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/word`, {
      credentials: "include", cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    return mapTakeWord(data?.word);
  } catch {
    return null;
  }
}

/** PUT …/word: save the word; `share` sends it to the speaker. */
export async function saveTakeWord(
  sessionId: string,
  input: { text: string; videoRef: string | null; share: boolean },
): Promise<{ ok: true; word: TakeWord | null } | { ok: false; message: string }> {
  try {
    const res = await fetch(`/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/word`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: input.text,
        ...(input.videoRef ? { video_ref: input.videoRef } : {}),
        share: input.share,
      }),
    });
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!res.ok) {
      return { ok: false, message: typeof data?.error === "string" ? data.error : "Couldn’t save the word." };
    }
    return { ok: true, word: mapTakeWord(data?.word) };
  } catch {
    return { ok: false, message: "Couldn’t save the word." };
  }
}

/* ── the catalogue of signed lines (the library's lines and moves) ────── */

export interface CatalogueLine {
  id: string;
  lane: "praise" | "rewrite";
  patternKind: "read" | "cue" | "device" | "move";
  patternKey: string;
  text: string;
  version: number;
  signedBy: string | null;
  active: boolean;
}

function mapLine(raw: unknown): CatalogueLine | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" && typeof r.id !== "number") return null;
  if (r.lane !== "praise" && r.lane !== "rewrite") return null;
  const kind = r.pattern_kind;
  if (kind !== "read" && kind !== "cue" && kind !== "device" && kind !== "move") return null;
  if (typeof r.pattern_key !== "string" || typeof r.text !== "string") return null;
  return {
    id: String(r.id), lane: r.lane, patternKind: kind, patternKey: r.pattern_key, text: r.text,
    version: typeof r.version === "number" ? r.version : 1,
    signedBy: typeof r.signed_by === "string" ? r.signed_by : null,
    active: r.active !== false,
  };
}

export async function listCatalogue(): Promise<CatalogueLine[]> {
  try {
    const res = await fetch("/api/v2/coach/catalogue", { credentials: "include", cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    return Array.isArray(data?.lines)
      ? data.lines.map(mapLine).filter((l): l is CatalogueLine => l !== null)
      : [];
  } catch {
    return [];
  }
}

export async function addCatalogueLine(input: {
  lane: "praise" | "rewrite";
  patternKind: "read" | "cue" | "device" | "move";
  patternKey: string;
  text: string;
}): Promise<{ ok: true; line: CatalogueLine | null } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/v2/coach/catalogue", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lane: input.lane, pattern_kind: input.patternKind,
        pattern_key: input.patternKey, text: input.text,
      }),
    });
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!res.ok) {
      return { ok: false, message: typeof data?.error === "string" ? data.error : "Couldn’t save the line." };
    }
    return { ok: true, line: mapLine(data?.line) };
  } catch {
    return { ok: false, message: "Couldn’t save the line." };
  }
}
