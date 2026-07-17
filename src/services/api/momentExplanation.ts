import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  momentExplanation — the SD paid layer: WHY a moment was a key moment       */
/*                                                                            */
/*  The single-deliverable model's ONLY paid item (5 credits, one-time per     */
/*  presentation): opening a key moment's coach explanation (note and/or       */
/*  video) in an overlay over the ideal-text page. The markers themselves are  */
/*  always visible free; this fetch 402s until unlock-moments has run.         */
/*  Safe-ahead: every call soft-fails; locked is a first-class state.          */
/* -------------------------------------------------------------------------- */

export type MomentExplanationResult =
  | { kind: "ready"; note: string | null; videoRef: string | null }
  | { kind: "locked"; priceCredits: number | null }
  | { kind: "error" };

export async function fetchMomentExplanation(
  arcId: string,
  momentId: string
): Promise<MomentExplanationResult> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/moments/${encodeURIComponent(momentId)}`,
      { headers, credentials: "include", cache: "no-store" }
    );
  } catch {
    return { kind: "error" };
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status === 402) {
    return {
      kind: "locked",
      priceCredits:
        typeof body?.price_credits === "number" ? body.price_credits : null,
    };
  }
  if (!res.ok || !body) return { kind: "error" };
  const note = typeof body.note === "string" && body.note.length > 0 ? body.note : null;
  const videoRef =
    typeof body.video_ref === "string" && body.video_ref.length > 0
      ? body.video_ref
      : null;
  return { kind: "ready", note, videoRef };
}

export type UnlockMomentsResult =
  | { ok: true }
  | { ok: false; reason: "insufficient" | "error"; message: string };

/** POST unlock-moments — debits 5 credits, entitles this presentation's moment
 *  explanations forever (idempotent BE-side; already_entitled → ok). */
export async function unlockMoments(arcId: string): Promise<UnlockMomentsResult> {
  const token = await getAuthToken();
  if (!token) {
    return { ok: false, reason: "error", message: "Sign in to unlock." };
  }
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/arc/${encodeURIComponent(arcId)}/unlock-moments`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } }
    );
  } catch {
    return { ok: false, reason: "error", message: "Couldn't reach the server. Try again." };
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok) return { ok: true };
  if (res.status === 402 || body?.code === "INSUFFICIENT_CREDITS") {
    return { ok: false, reason: "insufficient", message: "Not enough credits." };
  }
  const msg =
    (typeof body?.error === "string" && body.error) ||
    (typeof body?.message === "string" && body.message) ||
    "Couldn't unlock. Try again.";
  return { ok: false, reason: "error", message: msg };
}
