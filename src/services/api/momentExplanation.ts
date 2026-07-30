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
  | { ok: true; tokensRemaining: number | null }
  /** The legacy currency: a credit top-up genuinely fixes this. */
  | { ok: false; reason: "insufficient_credits"; message: string }
  /** Token pricing. A credit-pack top-up does NOT fix this — different
   *  currency — so the caller must not send anyone to the credit checkout. */
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

  // A token 402 is identified by its code OR by carrying `reason` at all —
  // the legacy credits error has neither, so an unlabelled 402 stays on the
  // old path (which is the live behaviour while the flag is off).
  const isTokenError =
    body?.code === "INSUFFICIENT_TOKENS" || typeof body?.reason === "string";

  if (res.status === 402 && isTokenError) {
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

  if (res.status === 402 || body?.code === "INSUFFICIENT_CREDITS") {
    return { ok: false, reason: "insufficient_credits", message: "Not enough credits." };
  }

  const msg =
    (typeof body?.error === "string" && body.error) ||
    (typeof body?.message === "string" && body.message) ||
    "Couldn't unlock. Try again.";
  return { ok: false, reason: "error", message: msg };
}
