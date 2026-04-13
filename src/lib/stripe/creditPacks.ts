/** Types and fallback packs when `STRIPE_CHECKOUT_PRICE_CREDITS_JSON` is unset on the server. */

/** Defaults match production Stripe prices; override via STRIPE_CHECKOUT_PRICE_CREDITS_JSON or NEXT_PUBLIC_STRIPE_PRICE_*. */
const DEFAULT_PRICE_IDS = {
  starter: "price_1TLerz2EsedzX77rccFwDhqw",
  standard: "price_1TL8jF2EsedzX77r1SkL2sgM",
  premium: "price_1TLesG2EsedzX77rz4Llh8mh",
} as const;

function priceIdFromEnv(envKey: string, fallback: string): string {
  const v = process.env[envKey]?.trim();
  return v || fallback;
}

export type CreditPackTier = "starter" | "standard" | "premium";

export interface CreditPackDisplay {
  tier: CreditPackTier;
  priceId: string;
  title: string;
  priceUsd: number;
  credits: number;
  blurb: string;
}

/** Fallback order: left → right (middle = standard / “best value”). */
export function getFallbackCreditPackDisplay(): CreditPackDisplay[] {
  return [
    {
      tier: "starter",
      priceId: priceIdFromEnv(
        "NEXT_PUBLIC_STRIPE_PRICE_STARTER",
        DEFAULT_PRICE_IDS.starter
      ),
      title: "Starter",
      priceUsd: 25,
      credits: 25,
      blurb: "Try the flow with a small top-up.",
    },
    {
      tier: "standard",
      priceId: priceIdFromEnv(
        "NEXT_PUBLIC_STRIPE_PRICE_STANDARD",
        DEFAULT_PRICE_IDS.standard
      ),
      title: "Standard",
      priceUsd: 45,
      credits: 50,
      blurb: "Best value for regular practice.",
    },
    {
      tier: "premium",
      priceId: priceIdFromEnv(
        "NEXT_PUBLIC_STRIPE_PRICE_PREMIUM",
        DEFAULT_PRICE_IDS.premium
      ),
      title: "Premium",
      priceUsd: 90,
      credits: 100,
      blurb: "Maximum credits per purchase.",
    },
  ];
}

export function getFallbackCreditPacks(): Record<string, number> {
  return Object.fromEntries(
    getFallbackCreditPackDisplay().map((p) => [p.priceId, p.credits])
  );
}
