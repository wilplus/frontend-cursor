/* -------------------------------------------------------------------------- */
/*  The coach's students: the three reads (founder 2026-10-01, Phase 0b).      */
/*                                                                            */
/*    GET /api/v2/coach/students                       -> the roster          */
/*    GET /api/v2/coach/students/:userId               -> a profile + Takes   */
/*    GET /api/v2/coach/sessions/:sid/walk-take        -> one take, walk shape */
/*                                                                            */
/*  Every read soft-fails: the roster draws empty, the profile says it could   */
/*  not load, the walk does not open. Nothing is written from here.           */
/* -------------------------------------------------------------------------- */

import {
  mapCoachStudentProfile, mapCoachStudents, mapWalkTake,
  type CoachStudent, type CoachStudentProfile,
} from "@/lib/willab/coachStudents";
import type { QueueSpeaker, QueueTake } from "@/lib/willab/coachWalk";
import { coachReadInit } from "./coachAuth";

export type StudentsResult =
  | { ok: true; students: CoachStudent[] }
  | { ok: false; code: "FORBIDDEN" | "UNAVAILABLE" };

async function get(url: string): Promise<Response | null> {
  try {
    return await fetch(url, await coachReadInit());
  } catch {
    return null;
  }
}

export async function fetchCoachStudents(): Promise<StudentsResult> {
  const res = await get("/api/v2/coach/students");
  if (!res) return { ok: false, code: "UNAVAILABLE" };
  if (res.status === 401 || res.status === 403) return { ok: false, code: "FORBIDDEN" };
  if (!res.ok) return { ok: false, code: "UNAVAILABLE" };
  return { ok: true, students: mapCoachStudents(await res.json().catch(() => null)) };
}

export async function fetchCoachStudentProfile(userId: string): Promise<CoachStudentProfile | null> {
  const res = await get(`/api/v2/coach/students/${encodeURIComponent(userId)}`);
  if (!res || !res.ok) return null;
  return mapCoachStudentProfile(await res.json().catch(() => null));
}

export type WalkTakeResult =
  | { ok: true; speaker: QueueSpeaker; take: QueueTake }
  | { ok: false; code: "RATER_LANGUAGES_REQUIRED" | "LANGUAGE" | "FORBIDDEN" | "UNAVAILABLE" };

export async function fetchWalkTake(sessionId: string): Promise<WalkTakeResult> {
  const res = await get(`/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/walk-take`);
  if (!res) return { ok: false, code: "UNAVAILABLE" };
  if (res.status === 428) return { ok: false, code: "RATER_LANGUAGES_REQUIRED" };
  if (res.status === 409) return { ok: false, code: "LANGUAGE" };
  if (res.status === 401 || res.status === 403) return { ok: false, code: "FORBIDDEN" };
  if (!res.ok) return { ok: false, code: "UNAVAILABLE" };
  const mapped = mapWalkTake(await res.json().catch(() => null));
  return mapped ? { ok: true, ...mapped } : { ok: false, code: "UNAVAILABLE" };
}
