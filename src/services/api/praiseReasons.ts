import { bffFetch } from "@/lib/api/bffFetch";
import { readPraiseReason, type PraiseReason } from "@/lib/willab/praiseReason";

export type PraiseReasonsRead = {
  reasons: Record<string, PraiseReason>;
  /** Clips whose reason is still being written. */
  pending: string[];
};

/** The reasons written so far for these green clips of one Take (founder
 *  2026-10-18). Null on any failure: the walk shows the praise it had. */
export async function fetchPraiseReasons(
  arcId: string,
  takeSessionId: string,
  snippetIds: readonly string[],
): Promise<PraiseReasonsRead | null> {
  try {
    const query = new URLSearchParams({ take_session_id: takeSessionId, snippet_ids: snippetIds.join(",") });
    const result = await bffFetch(`/api/v2/explore/arc/${encodeURIComponent(arcId)}/praise-reasons?${query.toString()}`, {
      cache: "no-store",
    });
    if (result.kind !== "response" || !result.ok || !result.body || typeof result.body !== "object") return null;
    const body = result.body as { reasons?: unknown; pending?: unknown };
    const reasons: Record<string, PraiseReason> = {};
    if (body.reasons && typeof body.reasons === "object") {
      for (const [id, raw] of Object.entries(body.reasons as Record<string, unknown>)) {
        const reason = readPraiseReason(raw);
        if (reason) reasons[id] = reason;
      }
    }
    const pending = Array.isArray(body.pending) ? body.pending.filter((id): id is string => typeof id === "string") : [];
    return { reasons, pending };
  } catch {
    return null;
  }
}
