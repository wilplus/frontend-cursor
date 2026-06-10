/* -------------------------------------------------------------------------- */
/*  recutSession — admin on-demand re-segmentation (E-2 / S7)                  */
/*                                                                            */
/*  POST /api/v2/coach/sessions/<id>/recut → re-runs the segmenter on the       */
/*  session's STORED audio (no upload path) and returns the new snippets. The    */
/*  caller refetches the session after a success (useCoachReview.refresh) rather */
/*  than trusting the returned shape, so the review cards re-render from the      */
/*  canonical read. Coach-gated upstream.                                        */
/* -------------------------------------------------------------------------- */

export interface RecutResult {
  ok: boolean;
  /** Snippet count the re-cut produced, when the BE reports it (else null). */
  count: number | null;
  /** User-facing failure message (null on success). */
  message: string | null;
}

export async function recutSession(sessionId: string): Promise<RecutResult> {
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/recut`,
      { method: "POST", credentials: "include", cache: "no-store" }
    );
  } catch {
    return {
      ok: false,
      count: null,
      message: "Could not reach the segmenter. Try again in a moment.",
    };
  }

  const data = (await res.json().catch(() => ({}))) as {
    count?: number;
    snippets?: unknown[];
    error?: string;
  };

  if (!res.ok) {
    return {
      ok: false,
      count: null,
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
  return { ok: true, count, message: null };
}
