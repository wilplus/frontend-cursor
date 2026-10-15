import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  The speaker's shared Takes, for Stop sharing in Data & consent (founder    */
/*  2026-10-15, fix 3; Privacy 3.6 §4d).                                       */
/*                                                                            */
/*   GET /api/v2/user/takes/shares → { takes: [{ take_session_id, take_index,  */
/*        project, communities: [{ id, name, kind }] }] }                      */
/*   Stopping: PUT /api/v2/user/takes/<id>/share { none: true }                */
/* -------------------------------------------------------------------------- */

export interface SharedTake {
  takeSessionId: string;
  takeIndex: number | null;
  project: string;
  communities: { id: string; name: string | null; kind: string | null }[];
}

export function mapSharedTakes(raw: unknown): SharedTake[] {
  const takes = (raw as { takes?: unknown } | null)?.takes;
  if (!Array.isArray(takes)) return [];
  return takes.flatMap((t) => {
    const row = (t ?? {}) as Record<string, unknown>;
    if (typeof row.take_session_id !== "string") return [];
    const communities = Array.isArray(row.communities) ? row.communities : [];
    return [{
      takeSessionId: row.take_session_id,
      takeIndex: typeof row.take_index === "number" ? row.take_index : null,
      project: typeof row.project === "string" ? row.project : "",
      communities: communities.map((c) => {
        const r = (c ?? {}) as Record<string, unknown>;
        return {
          id: String(r.id ?? ""),
          name: typeof r.name === "string" ? r.name : null,
          kind: typeof r.kind === "string" ? r.kind : null,
        };
      }),
    }];
  });
}

/** The live shares, or null when they could not be read. */
export async function fetchSharedTakes(): Promise<SharedTake[] | null> {
  const result = await bffFetch("/api/v2/user/takes/shares", { cache: "no-store" });
  if (result.kind !== "response" || !result.ok) return null;
  return mapSharedTakes(result.body);
}

/** Stop sharing one Take: its clips leave every community at once. */
export async function stopSharingTake(takeSessionId: string): Promise<boolean> {
  const result = await bffFetch(
    `/api/v2/user/takes/${encodeURIComponent(takeSessionId)}/share`,
    { method: "PUT", json: { general: false, community_ids: [], none: true } },
  );
  return result.kind === "response" && result.ok;
}
