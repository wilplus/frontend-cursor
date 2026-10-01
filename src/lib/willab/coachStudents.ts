/* -------------------------------------------------------------------------- */
/*  The coach's students (founder 2026-10-01, Phase 0b), the pure half.        */
/*                                                                            */
/*  Students -> a student's profile -> their Takes -> the same coach walk for  */
/*  that Take (Judge first; BLIND COACH). Opened from a named profile the walk */
/*  may show the student's real name: coaches know their own students. What   */
/*  stays blind is the machine's read, and nothing here carries it.            */
/*                                                                            */
/*  Dark behind COACH_STUDENTS_ENABLED (default off). Off, the Lounge keeps    */
/*  the queue button alone and nothing here is fetched or drawn.               */
/* -------------------------------------------------------------------------- */

import { mapMomentsQueue, type QueueSpeaker, type QueueTake } from "./coachWalk";

/** Phase 0b's switch. A reviewed change flips it after the founder's yes. */
export const COACH_STUDENTS_ENABLED = false as const;

export interface CoachStudent {
  /** The drill-down key. "" when the row carries none: not drillable. */
  id: string;
  pseudonym: string;
  /** The student's real name when the backend may send it (0b on); else null
   *  and the pseudonym stands in. */
  name: string | null;
  domain: string;
  lastActive: string;
  sessionCount: number | null;
}

export interface CoachStudentTake {
  sessionId: string;
  takeIndex: number | null;
  topic: string;
  createdAt: string;
  arcId: string | null;
}

export interface CoachStudentProfile {
  pseudonym: string;
  name: string | null;
  domain: string;
  goal: string;
  previousGoal: string | null;
  goalChangedAt: string | null;
  takes: CoachStudentTake[];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function nameOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/** What the screens call the student: the real name when it rides, else the
 *  pseudonym. Never empty. */
export function studentLabel(s: { pseudonym: string; name: string | null }): string {
  return s.name ?? s.pseudonym;
}

export function mapCoachStudent(raw: unknown): CoachStudent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const pseudonym = str(r.pseudonym);
  if (!pseudonym) return null;
  return {
    id: str(r.user_id),
    pseudonym,
    name: nameOrNull(r.name),
    domain: str(r.domain),
    lastActive: str(r.last_active),
    sessionCount: typeof r.session_count === "number" && Number.isFinite(r.session_count) ? r.session_count : null,
  };
}

export function mapCoachStudents(raw: unknown): CoachStudent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(mapCoachStudent).filter((s): s is CoachStudent => s !== null);
}

function mapTake(raw: unknown): CoachStudentTake | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.session_id !== "string" || !r.session_id) return null;
  return {
    sessionId: r.session_id,
    takeIndex: typeof r.take_index === "number" ? r.take_index : null,
    topic: str(r.topic),
    createdAt: str(r.created_at),
    arcId: typeof r.arc_id === "string" && r.arc_id ? r.arc_id : null,
  };
}

export function mapCoachStudentProfile(raw: unknown): CoachStudentProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const pseudonym = str(r.pseudonym);
  if (!pseudonym) return null;
  const takes = Array.isArray(r.sessions)
    ? r.sessions.map(mapTake).filter((t): t is CoachStudentTake => t !== null)
    : [];
  // Newest first on screen, like the Takes a speaker sees.
  takes.sort((a, b) => (b.takeIndex ?? 0) - (a.takeIndex ?? 0) || b.createdAt.localeCompare(a.createdAt));
  return {
    pseudonym,
    name: nameOrNull(r.name),
    domain: str(r.domain),
    goal: str(r.goal),
    previousGoal: nameOrNull(r.previous_goal),
    goalChangedAt: nameOrNull(r.goal_changed_at),
    takes,
  };
}

/** GET /v2/coach/sessions/:sid/walk-take -> one speaker with one take, in the
 *  queue's own shape, so the walk opens over a Take from the profile exactly
 *  as it opens from the queue. The label is the real name when it rides. */
export function mapWalkTake(raw: unknown): { speaker: QueueSpeaker; take: QueueTake } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const speakers = mapMomentsQueue([r.speaker]);
  const take = speakers[0]?.takes[0];
  if (!take) return null;
  const name = nameOrNull(r.name);
  const speaker = name ? { ...speakers[0], pseudonym: name } : speakers[0];
  return { speaker, take };
}
