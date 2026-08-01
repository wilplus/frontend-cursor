import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  subscribe — start a monthly plan on Stripe                                 */
/*                                                                            */
/*  One call, straight through to the BE's own tier checkout. The FE never sees */
/*  a price id, never holds a Stripe secret, and never touches card details —   */
/*  Stripe collects on its hosted page and the BE's subscription webhook grants */
/*  the tier.                                                                   */
/*                                                                            */
/*  It owns exactly one thing the BE cannot: the return URLs, because those are */
/*  FE routes. The BE's defaults point at /account, which this app has no route  */
/*  for, so they are always sent explicitly.                                    */
/*                                                                            */
/*  There is no "which tiers are purchasable" probe any more. The BE is the only */
/*  holder of the price map, so the FE cannot know in advance — it offers every  */
/*  paid tier the BE published in /v2/tokens/prices and surfaces the refusal     */
/*  inline if the server cannot sell one. That is the honest trade: a rare       */
/*  in-place error message beats maintaining a second copy of the mapping just   */
/*  to pre-hide a button.                                                       */
/* -------------------------------------------------------------------------- */

/** Where Stripe returns to. `TokenWalletScreen` reads `?plan=` and renders the
 *  "being applied" / "no change" line. */
function returnUrls(): { success_url: string; cancel_url: string } {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return {
    success_url: `${origin}/dashboard/pricing?plan=success`,
    cancel_url: `${origin}/dashboard/pricing?plan=cancelled`,
  };
}

export type StartCheckoutResult =
  | { ok: true; url: string }
  /** The server cannot sell this tier: Stripe or the price map is
   *  unconfigured. Distinct from a transient failure, because retrying will
   *  not help and the wallet should say so plainly. */
  | { ok: false; reason: "unavailable"; message: string }
  | { ok: false; reason: "error"; message: string };

export async function startPlanCheckout(tier: string): Promise<StartCheckoutResult> {
  const token = await getAuthToken();
  if (!token) {
    return { ok: false, reason: "error", message: "Sign in to change your plan." };
  }
  let res: Response;
  try {
    res = await fetch("/api/v2/tokens/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tier, ...returnUrls() }),
    });
  } catch {
    return { ok: false, reason: "error", message: "Couldn't reach the server. Try again." };
  }

  const body = (await res.json().catch(() => null)) as
    | { checkout_url?: string; code?: string; error?: string }
    | null;

  if (res.ok && body?.checkout_url) return { ok: true, url: body.checkout_url };

  // DISABLED = no Stripe key. MISCONFIGURED = no price map. Neither is the
  // user's problem and neither is fixed by trying again.
  if (body?.code === "DISABLED" || body?.code === "MISCONFIGURED") {
    return {
      ok: false,
      reason: "unavailable",
      message: "Plans aren't available right now.",
    };
  }

  return {
    ok: false,
    reason: "error",
    message: body?.error?.trim() || "Couldn't start checkout. Try again.",
  };
}
