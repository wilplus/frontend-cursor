/* -------------------------------------------------------------------------- */
/*  coachStudents — the coach's student roster (E3 / §B.4)                      */
/*                                                                            */
/*  Pseudonymized end to end: a coach sees a stable pseudonym + domain (+ last  */
/*  activity), NEVER the user's real name or email (§14 red-line 6 / §S.6).     */
/*  `sessionCount` (sends-per-user) is the coach-throughput instrument — it      */
/*  surfaces who is sending heavily; optional until the BE adds it, rendered     */
/*  defensively when present.                                                   */
/* -------------------------------------------------------------------------- */

export interface CoachStudent {
  /** Stable per-user pseudonym (e.g. "Playful Octopus"). NEVER real name. */
  pseudonym: string;
  /** The user's profile domain enum key (public_speaking, sales, etc.). */
  domain: string;
  /** ISO-8601 of the student's last activity (the roster's sort key). */
  lastActive: string;
  /** Sends-per-user — the "is the coach drowning" instrument. Optional until
   *  the BE adds `session_count`; undefined → not rendered. */
  sessionCount?: number;
}

/** Map a BE row (snake_case) → CoachStudent. A missing pseudonym rejects the
 *  row (no identity = nothing to show); everything else defaults safely. */
export function mapCoachStudent(raw: unknown): CoachStudent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const pseudonym = typeof r.pseudonym === "string" ? r.pseudonym : "";
  if (!pseudonym) return null;
  return {
    pseudonym,
    domain: typeof r.domain === "string" ? r.domain : "",
    lastActive: typeof r.last_active === "string" ? r.last_active : "",
    sessionCount:
      typeof r.session_count === "number" && Number.isFinite(r.session_count)
        ? r.session_count
        : undefined,
  };
}

const ENDPOINT = "/api/v2/coach/students";

/**
 * Fetch the coach's roster. Soft-fails to [] on non-2xx (e.g. 403 for non-coach
 * users — the BE `@require_coach` gate is the real boundary), network errors, or
 * a missing route. Accepts `{ items: [...] }`, `{ students: [...] }`, or a bare
 * array (BE wrapping isn't pinned yet).
 */
export async function fetchCoachStudents(): Promise<CoachStudent[]> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as
    | { items?: unknown[]; students?: unknown[] }
    | unknown[]
    | null;
  if (!data) return [];
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.students)
    ? data.students
    : [];
  return items
    .map(mapCoachStudent)
    .filter((s): s is CoachStudent => s !== null);
}
