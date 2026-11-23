import { bffFetch } from "@/lib/api/bffFetch";

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

export interface ReadoutsFetchResult {
  rows: ReadoutSummaryRow[];
  /** False means the server answer was unavailable, not an empty history. */
  ok: boolean;
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

/** Fetch the Readout list (newest first), retaining failure information for
 * status reconciliation. The public row-only helper below keeps its existing
 * soft-fail contract for callers that only need data. */
export async function fetchReadoutsResult(): Promise<ReadoutsFetchResult> {
  const result = await bffFetch("/api/v2/user/readouts", { cache: "no-store" });
  if (result.kind !== "response" || !result.ok) return { rows: [], ok: false };

  const body = result.body as { readouts?: unknown } | null;
  const rows = body && Array.isArray(body.readouts) ? body.readouts : [];
  return {
    rows: rows.map(mapRow).filter((r): r is ReadoutSummaryRow => r !== null),
    ok: true,
  };
}

/** Fetch the Readout list (newest first). Soft-fails to []. */
export async function fetchReadouts(): Promise<ReadoutSummaryRow[]> {
  return (await fetchReadoutsResult()).rows;
}

/* -------------------------------------------------------------------------- */
/*  Home-status read — one background read per signed-in owner and state.      */
/*                                                                            */
/*  The Lounge can render from its own thread/session-state reads. Readouts    */
/*  only reconcile the small status chip, so this cache deliberately lives    */
/*  behind the chat-boot signal (useStatusHydration). It shares an in-flight   */
/*  request and retains its outcome for the current owner, while a publish    */
/*  signal may explicitly refresh it once the relevant state changes.         */
/*                                                                            */
/*  The owner id is part of the cache key. No readout rows can be reused after */
/*  an auth switch, and the cache is memory-only — it never enters storage.   */
/* -------------------------------------------------------------------------- */

interface StatusCache {
  ownerId: string;
  promise: Promise<ReadoutsFetchResult> | null;
  result: ReadoutsFetchResult | null;
}

let statusCache: StatusCache | null = null;

export function fetchReadoutsForStatus(
  ownerId: string,
  opts: { refresh?: boolean } = {},
): Promise<ReadoutsFetchResult> {
  if (!statusCache || statusCache.ownerId !== ownerId) {
    statusCache = { ownerId, promise: null, result: null };
  }

  if (statusCache.promise) return statusCache.promise;
  if (statusCache.result && !opts.refresh) return Promise.resolve(statusCache.result);

  const cache = statusCache;
  const promise = fetchReadoutsResult().catch(() => ({ rows: [], ok: false }));
  cache.promise = promise;
  void promise.then((result) => {
    // A different owner may have opened the app before this request settled.
    if (statusCache !== cache) return;
    cache.result = result;
    cache.promise = null;
  });
  return promise;
}

/** Test-only reset for the owner-scoped background read. */
export function __resetReadoutStatusCacheForTests(): void {
  statusCache = null;
}
