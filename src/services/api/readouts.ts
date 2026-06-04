import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  readouts — the user's Readout history / status list (§6a)                 */
/*                                                                            */
/*  GET /api/v2/user/readouts → { readouts: [{session_id, created_at, topic,   */
/*  state}], count } (newest first; note the readouts[] wrapper). Soft-fails    */
/*  to [] so a status reconcile never blocks a mount.                         */
/* -------------------------------------------------------------------------- */

export interface ReadoutSummaryRow {
  sessionId: string;
  createdAt: string;
  topic: string;
  state: string;
}

function mapRow(raw: unknown): ReadoutSummaryRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.session_id !== "string") return null;
  return {
    sessionId: r.session_id,
    createdAt: typeof r.created_at === "string" ? r.created_at : "",
    topic: typeof r.topic === "string" ? r.topic : "",
    state: typeof r.state === "string" ? r.state : "",
  };
}

/** Fetch the Readout list (newest first). Soft-fails to []. */
export async function fetchReadouts(): Promise<ReadoutSummaryRow[]> {
  const token = await getAuthToken();
  if (!token) return [];

  let res: Response;
  try {
    res = await fetch("/api/v2/user/readouts", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const body = (await res.json().catch(() => null)) as { readouts?: unknown } | null;
  const rows = body && Array.isArray(body.readouts) ? body.readouts : [];
  return rows.map(mapRow).filter((r): r is ReadoutSummaryRow => r !== null);
}
