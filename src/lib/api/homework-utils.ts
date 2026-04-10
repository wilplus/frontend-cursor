/**
 * Pure utility helpers for the homework flow.
 * Extracted from HomeworkFlowCard.tsx to keep the component lean.
 */
import type { AssignedExercise } from "@/lib/api/types-homework";

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

function openingTaskTextFromRecord(rec: Record<string, unknown>): string {
  const task = rec.task;
  if (typeof task === "string" && task.trim()) return task.trim();
  const taskText = rec.task_text;
  if (typeof taskText === "string" && taskText.trim()) return taskText.trim();
  const pool = rec.tasks_pool ?? rec.task_pool;
  if (Array.isArray(pool) && pool.length > 0) {
    const first = pool[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (first && typeof first === "object" && first !== null && "text" in first) {
      const t = (first as { text: unknown }).text;
      if (typeof t === "string" && t.trim()) return t.trim();
    }
  }
  const warmObj = rec.warm_up_task;
  if (warmObj && typeof warmObj === "object" && "text" in warmObj) {
    const t = (warmObj as { text: unknown }).text;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  const wtext = rec.warm_up_task_text;
  if (typeof wtext === "string" && wtext.trim()) return wtext.trim();
  return "";
}

/**
 * Opening step-1 prompt from POST /session/start or GET /session/status payloads.
 * Prefers `task`, `task_text`, `tasks_pool` / `task_pool` (top-level then nested `session`); legacy `warm_up_*` last.
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

const STEP0_VIDEO_URL_KEYS = [
  "tutor_video_url",
  "video_url",
  "homework_video_url",
  "coach_video_url",
  "assignment_video_url",
] as const;

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Step-0 video URL from GET /homework/session/status (or start) payloads.
 * Checks common top-level and `session` keys plus `assigned_exercises[].video_url`.
 */
export function resolveStep0VideoUrlFromStatusPayload(
  raw: Record<string, unknown> | null | undefined
): string | null {
  if (!raw || raw.has_active_session === true) return null;
  const session =
    raw.session && typeof raw.session === "object" && raw.session !== null
      ? (raw.session as Record<string, unknown>)
      : null;
  for (const key of STEP0_VIDEO_URL_KEYS) {
    const top = trimStr(raw[key]);
    if (top) return top;
    if (session) {
      const s = trimStr(session[key]);
      if (s) return s;
    }
  }
  const ex = raw.assigned_exercises;
  if (Array.isArray(ex)) {
    for (const item of ex) {
      if (item && typeof item === "object" && item !== null) {
        const u = trimStr((item as { video_url?: unknown }).video_url);
        if (u) return u;
      }
    }
  }
  return null;
}

const ASSIGNMENT_MAIN_SCREEN_STATES = new Set([
  "assignment",
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

/** Extract Vimeo video id from vimeo.com/123, vimeo.com/video/123, or player.vimeo.com/video/123. */
export function parseVimeoId(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  try {
    const match = u.match(/(?:vimeo\.com\/video\/|vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
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
