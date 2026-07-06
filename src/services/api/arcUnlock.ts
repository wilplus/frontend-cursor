import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  arcUnlock — spend credits to unlock an arc's paid deliverables ($25 model) */
/*                                                                            */
/*  The paid boundary moved off the record path entirely: recording, analysis,*/
/*  the automatic readout and the coach layer are all free. Four surfaces stay */
/*  paid per arc — the coach-corrected ideal text, the breakthroughs list, the */
/*  game and the snippet library — unlocked once via a single credit charge.   */
/*                                                                            */
/*  Flow (a paywall is NEVER an error): tap unlock → POST /unlock spends the   */
/*  credits atomically BE-side. If the balance is short, the BE returns 402    */
/*  with a checkout_endpoint to mint a fresh Stripe session (credits are       */
/*  single-use, so no static top-up link). 409 = already paid = a success.     */
/*                                                                            */
/*  Safe ahead of the BE: the /unlock route doesn't exist yet. A 404 / any     */
/*  non-{200,402,409} lands in `error`; the caller then shows a soft, retryable */
/*  notice (never an error screen), so nothing breaks before the BE ships.      */
/* -------------------------------------------------------------------------- */

/** Credits a single arc unlock costs. Display-only peg (1 credit = $1, so $25);
 *  the BE is authoritative for the actual charge. */
export const ARC_UNLOCK_CREDITS = 25;

export interface ArcUnlockSuccess {
  ok: true;
  /** True when the 409 already-paid path resolved it (still a success). */
  alreadyPaid: boolean;
  creditsRemaining: number | null;
}
export interface ArcUnlockInsufficient {
  ok: false;
  reason: "insufficient";
  required: number | null;
  current: number | null;
  /** BE-supplied relative path to mint a fresh checkout session; null → the
   *  caller falls back to the pricing page. */
  checkoutEndpoint: string | null;
}
export interface ArcUnlockError {
  ok: false;
  reason: "error";
  message: string;
}
export type ArcUnlockResult =
  | ArcUnlockSuccess
  | ArcUnlockInsufficient
  | ArcUnlockError;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function unlockArc(arcId: string): Promise<ArcUnlockResult> {
  const token = await getAuthToken();
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  let res: Response;
  try {
    res = await fetch(`/api/v2/arc/${encodeURIComponent(arcId)}/unlock`, {
      method: "POST",
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "error", message: "Network error. Try again." };
  }

  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  // 409 = already unlocked → treat as success (idempotent double-tap).
  if (res.status === 409) {
    return { ok: true, alreadyPaid: true, creditsRemaining: null };
  }
  if (res.ok) {
    return {
      ok: true,
      alreadyPaid: false,
      creditsRemaining: num(body?.credits_remaining),
    };
  }
  if (res.status === 402) {
    return {
      ok: false,
      reason: "insufficient",
      required: num(body?.required) ?? ARC_UNLOCK_CREDITS,
      current: num(body?.current),
      checkoutEndpoint:
        typeof body?.checkout_endpoint === "string" &&
        body.checkout_endpoint.length > 0
          ? body.checkout_endpoint
          : null,
    };
  }
  return {
    ok: false,
    reason: "error",
    message: "Couldn't unlock right now. Try again in a moment.",
  };
}
