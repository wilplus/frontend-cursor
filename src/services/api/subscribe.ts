import { bffFetch } from "@/lib/api/bffFetch";
import { TOKENS_COPY } from "@/components/tokens/copy";

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
  /** 409 ALREADY_ON_TIER — nothing went wrong, nothing to do. */
  | { ok: false; reason: "already"; message: string }
  /** 409 MANAGE_EXISTING — a DIFFERENT live subscription. Must route to the
   *  portal: pushing through checkout leaves them paying for two plans. */
  | { ok: false; reason: "manage"; message: string }
  | { ok: false; reason: "error"; message: string };

export async function startPlanCheckout(tier: string): Promise<StartCheckoutResult> {
  const result = await bffFetch("/api/v2/tokens/checkout", {
    method: "POST",
    json: { tier, ...returnUrls() },
  });
  if (result.kind === "unauthenticated") {
    return { ok: false, reason: "error", message: "Sign in to change your plan." };
  }
  if (result.kind === "network") {
    return { ok: false, reason: "error", message: "Couldn't reach the server. Try again." };
  }

  const body = result.body as
    | { checkout_url?: string; code?: string; error?: string }
    | null;

  if (result.ok && body?.checkout_url) return { ok: true, url: body.checkout_url };

  // DISABLED = no Stripe key. MISCONFIGURED = no price map. Neither is the
  // user's problem and neither is fixed by trying again.
  if (body?.code === "DISABLED" || body?.code === "MISCONFIGURED") {
    return {
      ok: false,
      reason: "unavailable",
      message: "Plans aren't available right now.",
    };
  }

  // The two 409s the BE distinguishes and this client used to flatten into
  // "Couldn't start checkout. Try again." — which was wrong twice over: the
  // first is not a failure, and the second must not be retried at all.
  if (body?.code === "ALREADY_ON_TIER") {
    return { ok: false, reason: "already", message: TOKENS_COPY.planAlreadyOnTier };
  }
  if (body?.code === "MANAGE_EXISTING") {
    return { ok: false, reason: "manage", message: TOKENS_COPY.planManageExisting };
  }

  return {
    ok: false,
    reason: "error",
    message: body?.error?.trim() || "Couldn't start checkout. Try again.",
  };
}

/* ------------------------------ billing portal ---------------------------- */

export type StartPortalResult =
  | { ok: true; url: string }
  /** 404 NO_SUBSCRIPTION. NOT an error to show: there is simply nothing to
   *  manage, so the caller renders nothing at all. */
  | { ok: false; reason: "none" }
  | { ok: false; reason: "unavailable"; message: string }
  | { ok: false; reason: "error"; message: string };

/** Open Stripe's billing portal: switch, cancel, fix a declined card, invoices.
 *
 *  MINTED ON THE CLICK, NEVER ON RENDER. Portal sessions expire, and putting a
 *  Stripe call inside the balance read would make a Stripe outage look like a
 *  missing balance. The backend pins the same rule with a test that greps its
 *  own source. Never cache or prefetch this URL.
 *
 *  `return_url` is always sent: the BE's default is {FRONTEND_URL}/account and
 *  this app has no /account route. */
export async function startBillingPortal(): Promise<StartPortalResult> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const result = await bffFetch("/api/v2/tokens/portal", {
    method: "POST",
    json: { return_url: `${origin}/dashboard/pricing?plan=managed` },
  });
  if (result.kind === "unauthenticated") {
    return { ok: false, reason: "error", message: "Sign in to manage your plan." };
  }
  if (result.kind === "network") {
    return { ok: false, reason: "error", message: TOKENS_COPY.planManageFailed };
  }

  const body = result.body as
    | { portal_url?: string; code?: string; error?: string }
    | null;

  if (result.ok && body?.portal_url) return { ok: true, url: body.portal_url };
  if (body?.code === "NO_SUBSCRIPTION") return { ok: false, reason: "none" };
  if (body?.code === "DISABLED") {
    return {
      ok: false,
      reason: "unavailable",
      message: "Plans aren't available right now.",
    };
  }
  return { ok: false, reason: "error", message: TOKENS_COPY.planManageFailed };
}
