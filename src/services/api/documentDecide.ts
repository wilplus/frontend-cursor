import { getAuthToken } from "@/lib/api/auth-client";
import type { DocumentSuggestion } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  documentDecide — routing a tracked-change decision to the RIGHT endpoint.  */
/*                                                                            */
/*  Three lanes, three endpoints (each does a different server operation, so   */
/*  the wrong one silently no-ops the decision):                              */
/*    new_take (block upgrade) → POST .../blocks/<block_key>/decide            */
/*        {action, take_session_id} — flips the block's incumbent to the       */
/*        challenger fragment, then reassembles.                              */
/*    prior_take               → POST .../prior-take/decide                    */
/*        {action, snippet_id, quote, proposed_text} — the previous take's     */
/*        wording replaces / stands.                                          */
/*    everything else          → the per-snippet suggestion-feedback endpoint  */
/*        (handled by the caller; only bakes a per-phrase ledger decision).    */
/*                                                                            */
/*  Both endpoints answer 409 STALE_OFFER / NOT_PENDING when a newer take      */
/*  moved the offer under us — the caller treats that as "refetch", not error. */
/* -------------------------------------------------------------------------- */

export type BlockDecideResult =
  | { kind: "ok" }
  /** 409 — a newer take changed/settled the offer. Refetch, do not error. */
  | { kind: "stale" }
  /** The lane is not deployed (404) or the request failed. */
  | { kind: "error" };

async function post(
  path: string,
  body: Record<string, unknown>
): Promise<BlockDecideResult> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "error" };
  }
  if (res.status === 409) return { kind: "stale" };
  if (!res.ok) return { kind: "error" };
  return { kind: "ok" };
}

/** MASTER DOCUMENT — decide a `new_take` block upgrade. */
export async function decideBlock(
  arcId: string,
  blockKey: number,
  action: "accept" | "keep",
  takeSessionId: string
): Promise<BlockDecideResult> {
  return post(
    `/api/v2/explore/arc/${encodeURIComponent(arcId)}/blocks/${encodeURIComponent(
      String(blockKey)
    )}/decide`,
    { action, take_session_id: takeSessionId }
  );
}

/** LIVING TRANSCRIPT — decide a `prior_take` cross-take change. The BE keys it
 *  on the change's snippet_id + the words (quote = current, proposed = the
 *  previous take's wording, required to accept). */
export async function decidePriorTake(
  arcId: string,
  s: DocumentSuggestion,
  action: "accept" | "keep"
): Promise<BlockDecideResult> {
  if (!s.snippetId) return { kind: "error" };
  return post(
    `/api/v2/explore/arc/${encodeURIComponent(arcId)}/prior-take/decide`,
    {
      action,
      snippet_id: s.snippetId,
      quote: s.quote,
      proposed_text: s.proposedText,
    }
  );
}
