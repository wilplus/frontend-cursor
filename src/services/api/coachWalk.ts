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
