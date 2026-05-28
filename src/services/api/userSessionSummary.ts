/**
 * Typed client for task 8's user-facing session summary endpoint.
 *
 *   GET /api/v2/user/sessions/<id>/summary  (BFF)
 *      → GET /v2/user/sessions/<id>/summary (BE cc4a50e)
 *
 * The handler mirrors admin-side metrics + commentary into the
 * user's surface during the publish gate window — explicit
 * allowlist on the BE side, never spreads the v2_sessions row. See
 * the BFF route's docstring for the field-level filter contract.
 */

export interface UserSessionSummaryMetrics {
  wpm: number | null;
  fillers: number | null;
  pause_ms: number | null;
  pitch_center_hz: number | null;
  dynamic_db: number | null;
  energy: number | null;
}

export interface UserSessionSummaryCommentary {
  kind: "ai_summary";
  body: string;
}

export interface UserSessionSummaryResponse {
  status: "pending_review" | "completed";
  metrics_ready: boolean;
  snippets_published: boolean;
  metrics: UserSessionSummaryMetrics;
  commentary: UserSessionSummaryCommentary | null;
  snippet_count_pending: number;
}

const buildEndpoint = (sessionId: string) =>
  `/api/v2/user/sessions/${encodeURIComponent(sessionId)}/summary`;

export async function fetchUserSessionSummary(
  sessionId: string
): Promise<UserSessionSummaryResponse | null> {
  let res: Response;
  try {
    res = await fetch(buildEndpoint(sessionId), { cache: "no-store" });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as
    | UserSessionSummaryResponse
    | null;
  return data;
}
