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
  /** FP-4 / BE-4 — opaque per-user id, the grouping key that collapses a
   *  student's sessions into ONE bubble. NOT PII. null until BE-4 ships it →
   *  the FE falls back to grouping by pseudonym. */
  userId: string | null;
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
  /** T4 (§7) — a COACH audio annotation upload (not a student take): no
   *  student, no arc. Badged in the queue and kept OUT of the per-student
   *  roster grouping. */
  annotationMode: boolean;
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
    userId:
      typeof r.user_id === "string" && r.user_id.length > 0 ? r.user_id : null,
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
    annotationMode: r.annotation_mode === true,
  };
}

/**
 * C2 — merge a fresh queue fetch with rows the FE optimistically published.
 *
 * The BE drops a session from `/v2/coach/queue` the moment it's published
 * (`list_review_queue` filters out `results_published_at`), so a freshly-✓'d
 * row would VANISH on the next poll instead of staying "done in place". This
 * keeps any locally-published row the BE no longer returns (as `done`), and
 * coerces a still-present published row to `done` in case the BE lags. FE-only,
 * no BE change (the agreed option (a)).
 */
export function reconcileReviewQueue(
  next: ReviewQueueRow[],
  published: ReviewQueueRow[]
): ReviewQueueRow[] {
  const publishedIds = new Set(published.map((r) => r.sessionId));
  const present = new Set(next.map((r) => r.sessionId));
  const merged = next.map((r) =>
    publishedIds.has(r.sessionId) ? { ...r, state: "done" as const } : r
  );
  const retained = published
    .filter((r) => !present.has(r.sessionId))
    .map((r) => ({ ...r, state: "done" as const }));
  return [...merged, ...retained];
}

/* -------------------------------------------------------------------------- */
/*  FP-4 — per-student grouping                                                 */
/*                                                                            */
/*  The queue arrives one row per session; a student who sent three takes made  */
/*  three rows (and three bubbles). We collapse them into ONE bubble per        */
/*  student, opening that student's recordings list. The grouping key is the    */
/*  user id (BE-4); until that ships, pseudonym is the fallback key.            */
/* -------------------------------------------------------------------------- */

export interface ReviewStudentGroup {
  /** Stable grouping key: "u:<user_id>" (BE-4) or "p:<pseudonym>" fallback. */
  key: string;
  /** The user id when known (BE-4) — lets the bubble open the full
   *  StudentDetailOverlay; null pre-BE-4 → the local row-list fallback. */
  userId: string | null;
  pseudonym: string;
  domain: string;
  /** This student's queue rows, oldest first (FIFO — longest-waiting first). */
  rows: ReviewQueueRow[];
  /** Rows still awaiting review (state !== "done") — the "N to review" count. */
  toReviewCount: number;
  /** Group lifecycle: pending if any row is pending, else in_progress if any is
   *  in_progress, else done (every session published). */
  state: ReviewQueueState;
  /** Earliest sent_at across the group — its thread sort key, so the
   *  longest-waiting student surfaces first (matches the per-row FIFO). */
  earliestSentAt: string;
  /** T4 (§7) — this "group" is a coach annotation upload, not a student. It
   *  never merges with a student and the bubble badges it as an annotation. */
  annotationMode: boolean;
}

/**
 * Collapse queue rows into one group per student. Groups preserve
 * first-appearance order; rows within a group are FIFO by sent_at. A group with
 * a user id (BE-4) can open the full student overlay; a pseudonym-only group
 * (pre-BE-4) still collapses and drives the local fallback list. Pure.
 */
export function groupReviewQueueByStudent(
  rows: ReviewQueueRow[]
): ReviewStudentGroup[] {
  const byKey = new Map<string, ReviewStudentGroup>();
  const order: string[] = [];
  for (const row of rows) {
    // user_id (BE-4) is the real key; pseudonym is the pre-BE-4 fallback. An
    // identity-less row (no id AND no pseudonym) keys by its own session so two
    // distinct blank-pseudonym students never merge into one bubble.
    // T4 — an annotation upload has no student, so it must NEVER merge into a
    // per-student bubble: key it by its own session and flag the group.
    const key = row.annotationMode
      ? `a:${row.sessionId}`
      : row.userId
      ? `u:${row.userId}`
      : row.pseudonym
      ? `p:${row.pseudonym}`
      : `s:${row.sessionId}`;
    let g = byKey.get(key);
    if (!g) {
      g = {
        key,
        // T4 — an annotation row may carry the student's user_id (it was left
        // ON their take), but the annotation is NOT that student: never let its
        // group inherit the id, or a tap would open the student's roster detail
        // instead of the annotation (it stays keyed a:<sessionId> regardless).
        userId: row.annotationMode ? null : row.userId ?? null,
        pseudonym: row.pseudonym,
        domain: row.domain,
        rows: [],
        toReviewCount: 0,
        state: "done",
        earliestSentAt: row.sentAt || "",
        annotationMode: row.annotationMode,
      };
      byKey.set(key, g);
      order.push(key);
    }
    g.rows.push(row);
    // Backfill identity from a later row if the first one lacked it.
    if (!g.pseudonym && row.pseudonym) g.pseudonym = row.pseudonym;
    if (!g.domain && row.domain) g.domain = row.domain;
    // Never backfill an id onto an annotation group (see above).
    if (!g.annotationMode && !g.userId && row.userId) g.userId = row.userId;
    if (row.sentAt && (!g.earliestSentAt || row.sentAt < g.earliestSentAt)) {
      g.earliestSentAt = row.sentAt;
    }
  }
  return order.map((key) => {
    const g = byKey.get(key) as ReviewStudentGroup;
    g.rows.sort((a, b) => (a.sentAt || "").localeCompare(b.sentAt || ""));
    g.toReviewCount = g.rows.filter((r) => r.state !== "done").length;
    g.state = g.rows.some((r) => r.state === "pending")
      ? "pending"
      : g.rows.some((r) => r.state === "in_progress")
      ? "in_progress"
      : "done";
    return g;
  });
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
