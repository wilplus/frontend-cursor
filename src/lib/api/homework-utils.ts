/**
 * Pure utility helpers for the homework flow.
 * Extracted from HomeworkFlowCard.tsx to keep the component lean.
 */
import type { AssignedExercise } from "@/lib/api/types-homework";
import { openingTaskTextFromRecord } from "@/lib/api/homework-task-fields";

/** Default task prompt when the backend assigns none. */
export const DEFAULT_TASK_PROMPT = "How was your day so far?";

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function resolveTaskText(text: unknown): string {
  return ((text as string | null | undefined) ?? "").trim() || DEFAULT_TASK_PROMPT;
}

/**
 * Opening step-1 prompt from POST /session/start or GET /session/status payloads.
 * Prefers `task` (string or `{ text }`), `task_text`, `tasks_pool` / `task_pool` (top-level then nested `session`).
 */
export function openingTaskTextFromApiPayload(data: Record<string, unknown> | null | undefined): string {
  if (!data) return "";
  const fromRoot = openingTaskTextFromRecord(data);
  if (fromRoot) return fromRoot;
  const session = data.session;
  if (session && typeof session === "object" && session !== null) {
    const fromSession = openingTaskTextFromRecord(session as Record<string, unknown>);
    if (fromSession) return fromSession;
  }
  return "";
}

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function resolveMediaUrlCandidate(value: unknown): string | null {
  const raw = trimStr(value);
  if (!raw) return null;
  // Absolute URLs or protocol-relative URLs are ready to use.
  if (/^(https?:)?\/\//i.test(raw)) return raw;
  // Backend may already return storage API paths.
  if (raw.startsWith("/storage/")) return raw;
  return null;
}

function buildSupabaseStoragePublicUrl(
  bucketValue: unknown,
  storagePathValue: unknown
): string | null {
  const bucket = trimStr(bucketValue);
  const storagePath = trimStr(storagePathValue).replace(/^\/+/, "");
  if (!bucket || !storagePath) return null;
  const base = trimStr(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${storagePath}`;
}

function resolveVideoUrlFromRecord(record: Record<string, unknown>): string | null {
  const urlKeys = [
    "tutor_video_url",
    "video_url",
    "homework_video_url",
    "coach_video_url",
    "assignment_video_url",
  ] as const;
  for (const key of urlKeys) {
    const resolved = resolveMediaUrlCandidate(record[key]);
    if (resolved) return resolved;
  }

  const bucketKeys = [
    "tutor_video_bucket",
    "video_bucket",
    "homework_video_bucket",
    "coach_video_bucket",
    "assignment_video_bucket",
    "bucket",
  ] as const;
  const pathKeys = [
    "tutor_video_storage_path",
    "video_storage_path",
    "homework_video_storage_path",
    "coach_video_storage_path",
    "assignment_video_storage_path",
    "storage_path",
    "path",
  ] as const;
  for (const bucketKey of bucketKeys) {
    for (const pathKey of pathKeys) {
      const built = buildSupabaseStoragePublicUrl(record[bucketKey], record[pathKey]);
      if (built) return built;
    }
  }
  return null;
}

/**
 * Step-0 video URL from GET /homework/session/status (or start) payloads.
 * Checks top-level + nested session URL aliases and Supabase storage fields.
 * Falls back to the first non-empty assigned exercise video URL.
 */
export function resolveStep0VideoUrlFromStatusPayload(
  raw: Record<string, unknown> | null | undefined
): string | null {
  if (!raw || raw.has_active_session === true) return null;
  const session =
    raw.session && typeof raw.session === "object" && raw.session !== null
      ? (raw.session as Record<string, unknown>)
      : null;

  const top = resolveVideoUrlFromRecord(raw);
  if (top) return top;
  if (session) {
    const nested = resolveVideoUrlFromRecord(session);
    if (nested) return nested;
  }

  const exercisesRaw = raw.assigned_exercises;
  if (Array.isArray(exercisesRaw)) {
    for (const exercise of exercisesRaw) {
      if (!exercise || typeof exercise !== "object") continue;
      const exRecord = exercise as Record<string, unknown>;
      const exUrl = resolveMediaUrlCandidate(exRecord.video_url);
      if (exUrl) return exUrl;
    }
  }
  return null;
}

const ASSIGNMENT_MAIN_SCREEN_STATES = new Set([
  "assignment",
  "assignment_ready",
  "homework",
  "practice",
  "ready",
  "start",
  "start_practice",
  "exercise",
]);

/**
 * True when status JSON implies the student should see step-0 assignment/video (not “submitted / waiting”).
 * Used to override stale `review_pending` or sessionStorage forced-waiting when the payload carries real homework.
 */
export function hasStep0HomeworkContentSignalsFromPayload(
  raw: Record<string, unknown> | null | undefined
): boolean {
  if (!raw || raw.has_active_session === true) return false;
  if (resolveStep0VideoUrlFromStatusPayload(raw)) return true;
  const exercises = raw.assigned_exercises;
  if (Array.isArray(exercises) && exercises.length > 0) return true;
  const desc =
    trimStr(raw.tutor_video_description) ||
    (raw.session &&
      typeof raw.session === "object" &&
      raw.session !== null &&
      trimStr((raw.session as Record<string, unknown>).tutor_video_description));
  if (desc) return true;
  const mss = trimStr(raw.main_screen_state).toLowerCase();
  if (mss && ASSIGNMENT_MAIN_SCREEN_STATES.has(mss)) return true;
  if (raw.has_assigned_homework === true) return true;
  if (raw.homework_ready === true) return true;
  return false;
}

type Step0AssignmentFingerprintExercise = {
  id: string;
  title: string;
  video_url: string;
  description: string;
};

/**
 * Stable fingerprint for step-0 assignment payload.
 * Used to detect "new homework sent" vs stale/repeated assignment data.
 */
export function getStep0HomeworkAssignmentFingerprint(
  raw: Record<string, unknown> | null | undefined
): string | null {
  if (!raw || raw.has_active_session === true) return null;
  const session =
    raw.session && typeof raw.session === "object" && raw.session !== null
      ? (raw.session as Record<string, unknown>)
      : null;
  const tutorVideoUrl = resolveStep0VideoUrlFromStatusPayload(raw) ?? "";
  const tutorVideoDescription =
    trimStr(raw.tutor_video_description) ||
    (session ? trimStr(session.tutor_video_description) : "");
  const mainScreenState = trimStr(raw.main_screen_state).toLowerCase();
  const hasAssignmentState = !!(mainScreenState && ASSIGNMENT_MAIN_SCREEN_STATES.has(mainScreenState));
  const hasAssignedHomework = raw.has_assigned_homework === true;
  const homeworkReady = raw.homework_ready === true;
  const exercisesRaw = raw.assigned_exercises;
  const exercises: Step0AssignmentFingerprintExercise[] = Array.isArray(exercisesRaw)
    ? exercisesRaw
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => ({
          id: trimStr(item.id),
          title: trimStr(item.title),
          video_url: trimStr(item.video_url),
          description: trimStr(item.description),
        }))
        .sort((a, b) =>
          `${a.id}|${a.title}|${a.video_url}|${a.description}`.localeCompare(
            `${b.id}|${b.title}|${b.video_url}|${b.description}`
          )
        )
    : [];

  const hasAnySignal =
    !!tutorVideoUrl ||
    !!tutorVideoDescription ||
    exercises.length > 0 ||
    hasAssignmentState ||
    hasAssignedHomework ||
    homeworkReady;

  if (!hasAnySignal) return null;
  return JSON.stringify({
    tutorVideoUrl,
    tutorVideoDescription,
    exercises,
    mainScreenState: hasAssignmentState ? mainScreenState : "",
    hasAssignedHomework,
    homeworkReady,
  });
}

/** Display title for an assigned exercise: avoid showing raw id (e.g. "0-intro"); prefer title or friendly label. */
export function exerciseDisplayTitle(ex: AssignedExercise): string {
  const t = (ex.title ?? "").trim();
  if (t && t !== ex.id) return t;
  if (ex.id === "0-intro") return "Intro";
  return t || ex.id || "Exercise";
}

export function normalizePercentScore(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v <= 1 ? v * 100 : v);
}

/** Coerce API value to string; backend may send { id, text } instead of a plain string. */
export function toText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "text" in v) {
    const t = (v as { text: unknown }).text;
    return typeof t === "string" ? t : String(t ?? "");
  }
  return String(v);
}

/** Stable string id for keys and state; backend may send id as object. */
export function toId(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "id" in v) {
    const id = (v as { id: unknown }).id;
    return typeof id === "string" ? id : String(id ?? "");
  }
  return String(v);
}

/** Format filler_words_count.breakdown for display (e.g. "um: 3, like: 2"). */
export function formatFillerBreakdown(breakdown: Record<string, number> | null | undefined): string {
  if (!breakdown || typeof breakdown !== "object") return "";
  return Object.entries(breakdown)
    .filter(([, n]) => typeof n === "number" && n > 0)
    .map(([word, n]) => `${word}: ${n}`)
    .join(", ");
}
