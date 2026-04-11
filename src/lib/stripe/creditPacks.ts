/** Stripe Price IDs → credit amounts (must match backend / webhook). */
export const CREDIT_PACKS: Record<string, number> = {
  price_1TKPUgCOBPOlZhfkrl0zSDcO: 25,
  price_1TKYIlCOBPOlZhfkd0918TOa: 50,
  price_1TKPW1COBPOlZhfkx3HkYG25: 100,
};

export type CreditPackTier = "starter" | "standard" | "premium";

export interface CreditPackDisplay {
  tier: CreditPackTier;
  priceId: string;
  title: string;
  priceUsd: number;
  credits: number;
  blurb: string;
}

/** Order: left → right on the pricing page (middle = standard / “best value”). */
export const CREDIT_PACK_DISPLAY: CreditPackDisplay[] = [
  {
    tier: "starter",
    priceId: "price_1TKPUgCOBPOlZhfkrl0zSDcO",
    title: "Starter",
    priceUsd: 25,
    credits: 25,
    blurb: "Try the flow with a small top-up.",
  },
  {
    tier: "standard",
    priceId: "price_1TKYIlCOBPOlZhfkd0918TOa",
    title: "Standard",
    priceUsd: 45,
    credits: 50,
    blurb: "Best value for regular practice.",
  },
  {
    tier: "premium",
    priceId: "price_1TKPW1COBPOlZhfkx3HkYG25",
    title: "Premium",
    priceUsd: 90,
    credits: 100,
    blurb: "Maximum credits per purchase.",
  },
];
