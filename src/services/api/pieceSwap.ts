import { getAuthToken } from "@/lib/api/auth-client";
import { mapIdealPieces, type IdealPiece } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  pieceSwap — the discernment DECISION (founder 2026-07-20)                  */
/*                                                                            */
/*  A pending swap's two buttons: accept lands the challenger (badge flips,    */
/*  the master text reassembles BE-side → version bump), reject pins the       */
/*  incumbent and the challenger is never re-offered.                          */
/*                                                                            */
/*  The challenger_snippet_id echo is the race guard: a newer take may have    */
/*  replaced the offer between render and tap. Both 409s (STALE_SWAP /         */
/*  NOT_PENDING) are NORMAL outcomes — the caller silently refetches and       */
/*  re-renders, never an error surface.                                        */
/* -------------------------------------------------------------------------- */

export type PieceSwapResult =
  | { kind: "ok"; piece: IdealPiece | null }
  | { kind: "stale" } // 409 — refetch silently, never an error
  | { kind: "error" };

export async function swapPiece(args: {
  arcId: string;
  pieceKey: number;
  action: "accept" | "reject";
  /** Echo of the challenger the user was LOOKING at (the race guard). */
  challengerSnippetId: string;
}): Promise<PieceSwapResult> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(args.arcId)}/pieces/${encodeURIComponent(String(args.pieceKey))}/swap`,
      {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          action: args.action,
          challenger_snippet_id: args.challengerSnippetId,
        }),
      }
    );
  } catch {
    return { kind: "error" };
  }
  if (res.status === 409) return { kind: "stale" };
  if (!res.ok) return { kind: "error" };
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  // The 200 echoes the updated piece; run it through the shared mapper so a
  // malformed echo degrades to null (caller refetches) instead of crashing.
  const mapped = body?.piece ? mapIdealPieces([body.piece]) : null;
  return { kind: "ok", piece: mapped?.[0] ?? null };
}
