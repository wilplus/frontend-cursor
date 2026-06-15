/* -------------------------------------------------------------------------- */
/*  coachStudentDetail — the coach's per-student drill-down (E-1b / S6)        */
/*                                                                            */
/*  GET /api/v2/coach/students/<user_id> → { pseudonym, domain, goal,          */
/*  sessions:[{session_id, topic, created_at, state}] }. Pseudonymized end to    */
/*  end: pseudonym + domain + the user's free-text goal + their session         */
/*  history — NEVER the real name or email (§B.4 / §14 red-line 6). `goal` is     */
/*  user free-text and may self-identify; that's inherent, not scrubbable.       */
/*  Soft-fails to null (no endpoint / 403 / network) → the FE shows nothing.     */
/* -------------------------------------------------------------------------- */

export interface CoachStudentSession {
  sessionId: string;
  topic: string;
  createdAt: string;
  /** Lifecycle state (review_pending / readout_ready / done / …) — display only. */
  state: string;
}

export interface CoachStudentDetail {
  pseudonym: string;
  domain: string;
  /** The user's free-text goal. May self-identify; never name/email. */
  goal: string;
  /** The previous goal before the most recent update. null if goal was never
   *  changed (or BE hasn't migrated add_goal_change_tracking.sql yet). */
  previousGoal: string | null;
  /** ISO timestamp of the most recent goal change. null when unchanged. */
  goalChangedAt: string | null;
  sessions: CoachStudentSession[];
}

function mapSession(raw: unknown): CoachStudentSession | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.session_id !== "string") return null;
  return {
    sessionId: r.session_id,
    topic: typeof r.topic === "string" ? r.topic : "",
    createdAt: typeof r.created_at === "string" ? r.created_at : "",
    state: typeof r.state === "string" ? r.state : "",
  };
}

export function mapCoachStudentDetail(raw: unknown): CoachStudentDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const pseudonym = typeof r.pseudonym === "string" ? r.pseudonym : "";
  // No identity = nothing to show — same pseudonymized contract as the roster.
  if (!pseudonym) return null;
  const sessions = Array.isArray(r.sessions)
    ? r.sessions
        .map(mapSession)
        .filter((s): s is CoachStudentSession => s !== null)
    : [];
  return {
    pseudonym,
    domain: typeof r.domain === "string" ? r.domain : "",
    goal: typeof r.goal === "string" ? r.goal : "",
    previousGoal:
      typeof r.previous_goal === "string" && r.previous_goal.length > 0
        ? r.previous_goal
        : null,
    goalChangedAt:
      typeof r.goal_changed_at === "string" ? r.goal_changed_at : null,
    sessions,
  };
}

export async function fetchCoachStudentDetail(
  userId: string
): Promise<CoachStudentDetail | null> {
  let res: Response;
  try {
    res = await fetch(`/api/v2/coach/students/${encodeURIComponent(userId)}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  return mapCoachStudentDetail(await res.json().catch(() => null));
}
