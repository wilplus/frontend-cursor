import "server-only";

/* -------------------------------------------------------------------------- */
/*  subscriptionTiers — tier name → recurring Stripe Price id                  */
/*                                                                            */
/*  Read from STRIPE_PRICE_TIER_JSON, which is {price_id: tier} — the SAME env */
/*  var name and shape the backend's stripe_subscription_tiers.py parses. That  */
/*  is deliberate: the FE resolves tier → price to CREATE the checkout, and the */
/*  BE resolves price → tier when the subscription webhook lands. Two readers,  */
/*  one value. Giving them different names or shapes is how someone pays for    */
/*  Pro and gets Starter, so if this ever needs to diverge, have the BE serve    */
/*  the ids rather than keeping a second copy here.                             */
/*                                                                            */
/*  UNCONFIGURED IS NOT AN ERROR, IT IS "NOT FOR SALE". A tier with no price id */
/*  is simply not purchasable and renders no button — the same rule every price */
/*  surface here follows: never a control that cannot do what it says.          */
/*                                                                            */
/*  "free" is never purchasable even if someone maps a price to it: you do not  */
/*  check out in order to stop paying.                                          */
/* -------------------------------------------------------------------------- */

export type PaidTier = "starter" | "pro" | "max";

const PAID_TIERS: readonly PaidTier[] = ["starter", "pro", "max"];

export function isPaidTier(v: unknown): v is PaidTier {
  return typeof v === "string" && (PAID_TIERS as readonly string[]).includes(v);
}

/** tier → price id. Empty when the env var is missing or unparseable, which
 *  means "nothing is for sale", not "something is broken". */
export function getTierPriceMap(): Partial<Record<PaidTier, string>> {
  const raw = process.env.STRIPE_PRICE_TIER_JSON?.trim();
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Same posture as the BE parser: a malformed map yields nothing rather than
    // throwing, so a config typo cannot take the wallet down with it.
    console.error("STRIPE_PRICE_TIER_JSON is not valid JSON — no tier is purchasable");
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};

  const out: Partial<Record<PaidTier, string>> = {};
  for (const [priceId, tier] of Object.entries(parsed as Record<string, unknown>)) {
    const t = typeof tier === "string" ? tier.trim().toLowerCase() : "";
    if (!isPaidTier(t)) continue; // includes "free" — never purchasable
    const id = priceId.trim();
    if (!id.startsWith("price_")) continue;
    // First mapping wins, so a duplicated tier cannot silently reprice.
    if (out[t] === undefined) out[t] = id;
  }
  return out;
}

/** The tiers that can actually be bought right now. */
export function purchasableTiers(): PaidTier[] {
  const map = getTierPriceMap();
  return PAID_TIERS.filter((t) => typeof map[t] === "string");
}
