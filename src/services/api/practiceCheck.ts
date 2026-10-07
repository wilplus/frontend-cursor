import { getAuthToken } from "@/lib/api/auth-client";

/** What the walk may see of the machine's check: the next step and the
 * signed line's key. Never a number, a lane or a cue value (AC-9). */
export interface PracticeCheck {
  next: "praise" | "again";
  key: string | null;
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
    next: row.next === "praise" ? "praise" : "again",
    key: typeof row.key === "string" ? row.key : null,
  };
}

export function checkPracticeAttempt(
  practiceId: string,
  attemptId: string,
): Promise<Outcome<PracticeCheck>> {
  return call(
    `/api/v2/user/confidence-practice/${encodeURIComponent(practiceId)}/attempts/${encodeURIComponent(attemptId)}/check`,
    { method: "POST", body: {} },
    mapPracticeCheck,
  );
}
