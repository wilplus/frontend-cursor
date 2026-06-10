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
  /** Opaque user id for the drill-down (E-1b / S6 is keyed by it). NOT PII —
   *  an id, not a name/email. Empty when the BE row omits it → not drillable. */
  id: string;
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

/** Coerce the first usable id from candidate fields: a non-empty string, or a
 *  finite number stringified (some BE serializers send numeric ids). "" when
 *  none → the row isn't drillable. */
function coerceId(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
    if (typeof c === "number" && Number.isFinite(c)) return String(c);
  }
  return "";
}

/** Map a BE row (snake_case) → CoachStudent. A missing pseudonym rejects the
 *  row (no identity = nothing to show); everything else defaults safely. */
export function mapCoachStudent(raw: unknown): CoachStudent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const pseudonym = typeof r.pseudonym === "string" ? r.pseudonym : "";
  if (!pseudonym) return null;
  return {
    // Drill-down key (E-1b). Prefer user_id, fall back to id; string OR number.
    id: coerceId(r.user_id, r.id),
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

/** Result of a roster fetch. `forbidden` distinguishes "not authorized" (403,
 *  caller isn't on the coach/admin allowlist) from an authorized coach with an
 *  empty roster (E-1a c) — collapsing both to [] is exactly why the roster
 *  looked broken ("no students yet" when the real cause was a 403). */
export interface CoachStudentsResult {
  students: CoachStudent[];
  forbidden: boolean;
}

/**
 * Fetch the coach's roster. `forbidden` is true ONLY on a 403 (the BE
 * `@require_coach` gate — caller isn't on the allowlist), so the UI can say
 * "you're not set up as a coach" instead of the misleading "no students yet".
 * Every other failure (network, 5xx, missing route, unparseable body) soft-fails
 * to an empty, non-forbidden result. Accepts `{ items: [...] }`,
 * `{ students: [...] }`, or a bare array.
 */
export async function fetchCoachStudents(): Promise<CoachStudentsResult> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return { students: [], forbidden: false };
  }
  if (res.status === 403) return { students: [], forbidden: true };
  if (!res.ok) return { students: [], forbidden: false };
  const data = (await res.json().catch(() => null)) as
    | { items?: unknown[]; students?: unknown[] }
    | unknown[]
    | null;
  if (!data) return { students: [], forbidden: false };
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.students)
    ? data.students
    : [];
  return {
    students: items
      .map(mapCoachStudent)
      .filter((s): s is CoachStudent => s !== null),
    forbidden: false,
  };
}
