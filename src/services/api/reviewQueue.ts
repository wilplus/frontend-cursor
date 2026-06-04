/* -------------------------------------------------------------------------- */
/*  reviewQueue — the coach's review queue (§14 / §3.8)                        */
/*                                                                            */
/*  The list of review_pending willab sessions for a coach. Keyed on the       */
/*  PSEUDONYMOUS user id (§14 red-line 6); the full transcript + goal appear    */
/*  only when the coach opens the session (the authoring view).                */
/*                                                                            */
/*  The endpoint itself is BE contract ① (still open) — the UI is built        */
/*  against this row shape, so wiring is a one-function swap once the path is    */
/*  confirmed. No guessed endpoint here.                                       */
/* -------------------------------------------------------------------------- */

export interface ReviewQueueRow {
  sessionId: string;
  topic: string;
  pseudonymousUserId: string;
  sentAt: string;
}

/** Map a BE row (snake_case) → ReviewQueueRow. Used once the endpoint lands. */
export function mapReviewQueueRow(raw: unknown): ReviewQueueRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.session_id !== "string") return null;
  return {
    sessionId: r.session_id,
    topic: typeof r.topic === "string" ? r.topic : "",
    pseudonymousUserId:
      typeof r.pseudonymous_user_id === "string" ? r.pseudonymous_user_id : "",
    sentAt: typeof r.sent_at === "string" ? r.sent_at : "",
  };
}

/**
 * Fetch the review queue (newest first). Returns [] until BE confirms ① —
 * then this becomes: GET the endpoint → rows.map(mapReviewQueueRow).
 */
export async function fetchReviewQueue(): Promise<ReviewQueueRow[]> {
  // TODO(BE ①): GET <confirmed review-queue path> →
  //   { items|readouts: [{ session_id, topic, pseudonymous_user_id, sent_at }] }
  //   → return body.<wrapper>.map(mapReviewQueueRow).filter(Boolean)
  return [];
}
