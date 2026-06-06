/* -------------------------------------------------------------------------- */
/*  reviewQueue — the coach's review queue (§14 / §B.1)                        */
/*                                                                            */
/*  The list of review-stage willab sessions for a coach. Identity-stripped    */
/*  end to end: a coach sees a stable pseudonym + domain + count + state,     */
/*  never the user's real name or email (§14 red-line 6 + §S.6).              */
/*                                                                            */
/*  Three lifecycle states (B.1 / B.7):                                       */
/*    "pending"     — user just sent, no coach action                          */
/*    "in_progress" — coach has saved ≥1 per-snippet draft                    */
/*    "done"        — coach published; user has been notified                  */
/*                                                                            */
/*  Returned in FIFO order by `sent_at` ascending (oldest first), so the      */
/*  coach naturally works the longest-waiting session first.                  */
/* -------------------------------------------------------------------------- */

export type ReviewQueueState = "pending" | "in_progress" | "done";

export interface ReviewQueueRow {
  sessionId: string;
  /** Stable per-user pseudonym (e.g. "Playful Octopus"). NEVER real name. */
  pseudonym: string;
  /** The user's profile domain enum key (public_speaking, sales, etc.). */
  domain: string;
  /** Optional per-session topic from session_context. May be empty. */
  topic: string;
  /** Total snippets in the session payload (the cap is ~10 per §14). */
  nSnippets: number;
  state: ReviewQueueState;
  /** ISO-8601 timestamp the session entered the review queue. */
  sentAt: string;
}

/** Map a BE row (snake_case) → ReviewQueueRow. Strict-bool / defensive: a
 *  missing `session_id` rejects the row; everything else gets sensible
 *  defaults so a partial BE payload still renders a usable bubble. */
export function mapReviewQueueRow(raw: unknown): ReviewQueueRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.session_id !== "string") return null;
  const state = r.state;
  return {
    sessionId: r.session_id,
    pseudonym: typeof r.pseudonym === "string" ? r.pseudonym : "",
    domain: typeof r.domain === "string" ? r.domain : "",
    topic: typeof r.topic === "string" ? r.topic : "",
    nSnippets:
      typeof r.n_snippets === "number" && Number.isFinite(r.n_snippets)
        ? r.n_snippets
        : 0,
    state:
      state === "pending" || state === "in_progress" || state === "done"
        ? state
        : "pending",
    sentAt: typeof r.sent_at === "string" ? r.sent_at : "",
  };
}

const ENDPOINT = "/api/v2/coach/queue";

/**
 * Fetch the coach's review queue. Soft-fails to [] on:
 *   - non-2xx (e.g., 403 for non-coach users — the BE auth gate is the
 *     real boundary; the FE `is_coach` flag is render-only)
 *   - network errors / JSON parse failures
 *   - missing BFF route (until BE ships the route, the BFF returns 404
 *     and this returns [])
 *
 * The caller (useReviewQueue) treats [] as "no queue to show" — the
 * coach-mode UI renders nothing rather than throwing.
 */
export async function fetchReviewQueue(): Promise<ReviewQueueRow[]> {
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
    | { items?: unknown[] }
    | unknown[]
    | null;
  if (!data) return [];
  // Accept either { items: [...] } or a bare array — both are common BE
  // wrapping conventions and we don't need to pick one yet.
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data.items)
    ? data.items
    : [];
  return items
    .map(mapReviewQueueRow)
    .filter((r): r is ReviewQueueRow => r !== null);
}
