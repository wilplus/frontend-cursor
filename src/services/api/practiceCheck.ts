import { outcomeCall as call, type Outcome } from "@/lib/api/bffCall";

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

export type { Outcome };

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
