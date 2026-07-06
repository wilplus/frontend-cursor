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
/*  { required, current } and the caller routes to the pricing page to top up  */
/*  (Stripe sessions are single-use — the BE never sends a reusable top-up      */
/*  link in the body). Two success shapes: 200 { unlocked, credits_remaining }  */
/*  and the pre-check 200 { already_entitled:true }; a raced 409 already-paid   */
/*  (refunded, no net charge) also resolves as success.                        */
/*                                                                            */
/*  A 404 / any non-{200,402,409} lands in `error`; the caller then shows a     */
/*  soft, retryable notice (never an error screen), so nothing breaks.          */
/* -------------------------------------------------------------------------- */

/** Credits a single arc unlock costs. Display-only peg (1 credit = $1, so $25);
 *  the BE is authoritative for the actual charge. */
export const ARC_UNLOCK_CREDITS = 25;

export interface ArcUnlockSuccess {
  ok: true;
  /** True when the arc was already paid — the 200 already_entitled pre-check or
   *  the 409 raced double-tap. Either way a success; the caller just refetches. */
  alreadyPaid: boolean;
  /** null on the already-entitled / 409 paths (no charge, so none returned). */
  creditsRemaining: number | null;
}
export interface ArcUnlockInsufficient {
  ok: false;
  reason: "insufficient";
  required: number | null;
  current: number | null;
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

  // 409 = raced already-unlocked → treat as success (idempotent double-tap).
  if (res.status === 409) {
    return { ok: true, alreadyPaid: true, creditsRemaining: null };
  }
  if (res.ok) {
    // 200 covers a fresh unlock ({ unlocked, credits_remaining }) AND the
    // pre-check already-entitled path ({ already_entitled:true, arc_id }); both
    // are a success → the caller refetches the now-open deliverable.
    return {
      ok: true,
      alreadyPaid: body?.already_entitled === true,
      creditsRemaining: num(body?.credits_remaining),
    };
  }
  if (res.status === 402) {
    // INSUFFICIENT_CREDITS { required, current } — no checkout_endpoint is ever
    // sent (single-use Stripe sessions can't be pre-minted), so the caller
    // routes to the pricing page to mint a fresh session there.
    return {
      ok: false,
      reason: "insufficient",
      required: num(body?.required) ?? ARC_UNLOCK_CREDITS,
      current: num(body?.current),
    };
  }
  return {
    ok: false,
    reason: "error",
    message: "Couldn't unlock right now. Try again in a moment.",
  };
}
