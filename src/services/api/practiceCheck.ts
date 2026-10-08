import { getAuthToken } from "@/lib/api/auth-client";

/** What the walk may see of the machine's check: the next step and the
 * signed line's key. Never a number, a lane or a cue value (AC-9). */
export interface PracticeCheck {
  /** "moved_on": the third try that is not praise (CM3a A, CM3b A). */
  next: "praise" | "again" | "moved_on";
  key: string | null;
}

/** A check with what the walk needs after it: the try's own words on a
 *  praise, which the helper words are tapped from (services/practice_check.py
 *  `attempt_transcript`). Words, never a number. */
export interface PracticeCheckResult {
  check: PracticeCheck;
  attemptWords: string | null;
}

export type Outcome<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string | null };

async function call<T>(
  path: string,
  init: { method: "GET" | "POST" | "PUT"; body?: unknown },
  map: (data: Record<string, unknown>) => T,
): Promise<Outcome<T>> {
  try {
    const token = await getAuthToken();
    if (!token) return { ok: false, status: 401, code: "NO_SESSION" };
    const res = await fetch(path, {
      method: init.method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      return { ok: false, status: res.status, code: typeof data?.code === "string" ? data.code : null };
    }
    return { ok: true, data: map(data ?? {}) };
  } catch {
    return { ok: false, status: 0, code: null };
  }
}

export function mapPracticeCheck(data: Record<string, unknown>): PracticeCheck {
  const check = data.check;
  const row = check !== null && typeof check === "object" ? (check as Record<string, unknown>) : {};
  return {
    next: row.next === "praise" || row.next === "moved_on" ? row.next : "again",
    key: typeof row.key === "string" ? row.key : null,
  };
}

export function mapPracticeCheckResult(data: Record<string, unknown>): PracticeCheckResult {
  const words = data.attempt_transcript;
  return {
    check: mapPracticeCheck(data),
    attemptWords: typeof words === "string" && words.trim() ? words : null,
  };
}

export function checkPracticeAttempt(
  practiceId: string,
  attemptId: string,
): Promise<Outcome<PracticeCheckResult>> {
  return call(
    `/api/v2/user/confidence-practice/${encodeURIComponent(practiceId)}/attempts/${encodeURIComponent(attemptId)}/check`,
    { method: "POST", body: {} },
    mapPracticeCheckResult,
  );
}
