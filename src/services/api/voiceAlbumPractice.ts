import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  "Practice new" — clips still waiting for your Confident Voice answer.      */
/*                                                                            */
/*  The queue is built from the machine's stars, not from Manager-exposed      */
/*  cards: a card only exists once a Take's review has been opened, so a       */
/*  card-based queue would hold only what you were shown and skipped.          */
/*                                                                            */
/*  The answer is owner routing on the exact clip. It is never a blind peer    */
/*  label and never a coach judgment, and only a `yes` can help a moment into  */
/*  the Voice Album — alongside the machine and coach legs, never on its own.  */
/* -------------------------------------------------------------------------- */

/** The instrument's five states (contract §29), stored whole. */
export type PracticeAnswer =
  | "yes"
  | "in_between"
  | "no"
  | "not_sure"
  | "audio_unclear";

export interface PracticeClip {
  snippetId: string;
  projectId: string;
  projectTitle: string | null;
  takeSessionId: string;
  takeIndex: number | null;
  slideIndex: number | null;
  audioUrl: string | null;
  startOffsetMs: number | null;
  durationMs: number | null;
}

export interface PracticeQueue {
  mine: PracticeClip[];
  /** Coach-uploaded shared corpus. Phase-2 — not served yet. */
  general: PracticeClip[];
  generalAvailable: boolean;
}

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function mapClip(raw: unknown): PracticeClip | null {
  const row = rec(raw);
  if (!row) return null;
  const snippetId = str(row.snippet_id);
  const projectId = str(row.arc_id);
  const takeSessionId = str(row.take_session_id);
  // All three identify the exact recording the answer is about. A row missing
  // any of them cannot be answered, so it is dropped rather than shown.
  if (!snippetId || !projectId || !takeSessionId) return null;
  return {
    snippetId,
    projectId,
    projectTitle: str(row.arc_title),
    takeSessionId,
    takeIndex: num(row.take_index),
    slideIndex: num(row.slide_index),
    audioUrl: str(row.audio_url),
    startOffsetMs: num(row.start_offset_ms),
    durationMs: num(row.duration_ms),
  };
}

/** null = the read failed; an empty `mine` = nothing left to answer. */
export async function fetchPracticeQueue(): Promise<PracticeQueue | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch("/api/v2/voice-album/practice-queue", {
      method: "GET",
      headers: await authHeaders(),
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) return null;
  const body = rec(await response.json().catch(() => null));
  if (!body) return null;

  const mine: PracticeClip[] = [];
  for (const raw of Array.isArray(body.mine) ? body.mine : []) {
    const clip = mapClip(raw);
    if (clip) mine.push(clip);
  }
  const general: PracticeClip[] = [];
  for (const raw of Array.isArray(body.general) ? body.general : []) {
    const clip = mapClip(raw);
    if (clip) general.push(clip);
  }
  return { mine, general, generalAvailable: body.general_available === true };
}

export async function savePracticeAnswer(
  clip: PracticeClip,
  answer: PracticeAnswer
): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch("/api/v2/voice-album/practice-answer", {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        arc_id: clip.projectId,
        take_session_id: clip.takeSessionId,
        snippet_id: clip.snippetId,
        response: answer,
      }),
    });
  } catch {
    return false;
  }
  return response.ok;
}
