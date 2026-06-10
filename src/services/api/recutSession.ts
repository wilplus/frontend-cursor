/* -------------------------------------------------------------------------- */
/*  recutSession — admin on-demand re-segmentation (E-2 / S7 / BE-6)           */
/*                                                                            */
/*  POST /api/v2/coach/sessions/<id>/recut → re-runs the segmenter on the       */
/*  session's STORED audio (no upload) and returns the new snippets. Re-cut      */
/*  MINTS NEW snippet ids, so it orphans any labels / notes / drafts already on  */
/*  the session. The BE refuses a labeled, unpublished session with              */
/*  409 RECUT_WOULD_DISCARD_LABELS { labels, drafts } and only proceeds on        */
/*  ?force=true (deleting the orphans). So the FE tries WITHOUT force first; on   */
/*  the 409 it surfaces the BE's exact counts (drafts included — the FE can't     */
/*  see those locally) and, once the coach confirms, re-calls with force=true.    */
/*  After a success the caller refetches the session (useCoachReview.refresh)     */
/*  rather than trusting the returned shape. Coach-gated upstream.               */
/* -------------------------------------------------------------------------- */

export type RecutResult =
  | { status: "ok"; count: number | null }
  /** 409 — re-cut would discard existing review work; confirm + retry w/ force. */
  | { status: "needs_confirm"; labels: number; drafts: number }
  | { status: "error"; message: string };

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export async function recutSession(
  sessionId: string,
  options?: { force?: boolean }
): Promise<RecutResult> {
  const qs = options?.force ? "?force=true" : "";
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/recut${qs}`,
      { method: "POST", credentials: "include", cache: "no-store" }
    );
  } catch {
    return {
      status: "error",
      message: "Could not reach the segmenter. Try again in a moment.",
    };
  }

  const data = (await res.json().catch(() => ({}))) as {
    count?: number;
    snippets?: unknown[];
    code?: string;
    error?: string;
    labels?: number;
    drafts?: number;
    detail?: { labels?: number; drafts?: number };
  };

  // BE-6 — labeled, unpublished session: the re-cut is refused unless
  // ?force=true. Surface the counts so the coach confirms the discard, then we
  // re-call with force. The recut endpoint's only 409 is this one.
  if (res.status === 409) {
    return {
      status: "needs_confirm",
      labels: num(data.labels ?? data.detail?.labels),
      drafts: num(data.drafts ?? data.detail?.drafts),
    };
  }

  if (!res.ok) {
    return {
      status: "error",
      message:
        typeof data.error === "string" && data.error
          ? data.error
          : `Re-cut failed (HTTP ${res.status}).`,
    };
  }

  const count =
    typeof data.count === "number"
      ? data.count
      : Array.isArray(data.snippets)
        ? data.snippets.length
        : null;
  return { status: "ok", count };
}
