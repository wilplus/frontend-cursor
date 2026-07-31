import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  momentExplanation — the SD paid layer: WHY a moment was a key moment       */
/*                                                                            */
/*  The single-deliverable model's ONLY explicitly-purchased item (one-time    */
/*  per presentation): opening a key moment's coach explanation (note and/or   */
/*  video) in an overlay over the ideal-text page. The markers themselves are  */
/*  always visible free; this fetch 402s until unlock-moments has run.         */
/*  Safe-ahead: every call soft-fails; locked is a first-class state.          */
/* -------------------------------------------------------------------------- */

export type MomentExplanationResult =
  | { kind: "ready"; note: string | null; videoRef: string | null }
  | { kind: "locked" }
  // FE-1 (gradual refinement) — nothing is behind the paywall yet (the coach
  // hasn't explained anything): the sheet shows the free content only, and NO
  // unlock CTA exists anywhere. Client-derived, never fetched.
  | { kind: "unavailable" }
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
    // The BE still echoes `price_credits` on MOMENTS_LOCKED, but credits are
    // retired (founder 2026-07-31) and the unlock charges tokens. The price on
    // the CTA comes from the published token list instead, so the locked state
    // carries no price of its own.
    return { kind: "locked" };
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
  | { ok: true; tokensRemaining: number | null }
  | { ok: false; reason: "insufficient_tokens"; message: string; required: number | null; current: number | null; }
  /** The coach-review cap, which no amount of buying can lift. Upgrade only. */
  | { ok: false; reason: "coach_cap_reached"; message: string }
  | { ok: false; reason: "error"; message: string };

/** POST unlock-moments — entitles this presentation's moment explanations
 *  forever (idempotent BE-side; already_entitled → ok).
 *
 *  It is charged in CREDITS today and in TOKENS once pricing is on, and the
 *  402 tells you which: `INSUFFICIENT_TOKENS` (with a `reason`) versus the
 *  legacy `INSUFFICIENT_CREDITS`. Callers MUST branch, because the two need
 *  opposite next steps and the currencies are not interchangeable. Sending a
 *  token-poor user to the credit-pack page takes their money for something
 *  that cannot unlock anything.
 *
 *  Within the token 402, `reason` splits again: `insufficient` (offer the
 *  renewal date, or a plan change once one exists) versus `coach_cap_reached`
 *  (upgrade only, never a top-up — the cap protects the coach's calendar and
 *  is not for sale). */
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
  if (res.ok) {
    const remaining = body?.tokens_remaining;
    return {
      ok: true,
      tokensRemaining:
        typeof remaining === "number" && Number.isFinite(remaining) ? remaining : null,
    };
  }

  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  // Tokens are the only currency now. `reason` still splits the two remedies:
  // `coach_cap_reached` is a cap no purchase lifts, everything else is a
  // shortfall that the monthly renewal (or a plan change) resolves.
  if (res.status === 402) {
    if (body?.reason === "coach_cap_reached") {
      return {
        ok: false,
        reason: "coach_cap_reached",
        message: "Coach review limit reached.",
      };
    }
    return {
      ok: false,
      reason: "insufficient_tokens",
      message: "Not enough tokens.",
      required: num(body?.required),
      current: num(body?.current),
    };
  }

  const msg =
    (typeof body?.error === "string" && body.error) ||
    (typeof body?.message === "string" && body.message) ||
    "Couldn't unlock. Try again.";
  return { ok: false, reason: "error", message: msg };
}
