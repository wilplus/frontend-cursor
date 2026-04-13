import "server-only";

import type { CreditPackDisplay, CreditPackTier } from "./creditPacks";
import {
  getFallbackCreditPackDisplay,
  getFallbackCreditPacks,
} from "./creditPacks";

const CHECKOUT_PRICE_CREDITS_JSON = "STRIPE_CHECKOUT_PRICE_CREDITS_JSON";

function parseCheckoutPriceCreditsJson(): Record<string, number> | null {
  const raw = process.env[CHECKOUT_PRICE_CREDITS_JSON]?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (
        typeof k === "string" &&
        k.startsWith("price_") &&
        typeof v === "number" &&
        Number.isFinite(v) &&
        v > 0
      ) {
        out[k] = v;
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch (err) {
    console.warn(
      "[stripe] STRIPE_CHECKOUT_PRICE_CREDITS_JSON invalid; using fallback packs.",
      err
    );
    return null;
  }
}

const USD_BY_CREDITS: Record<number, number> = {
  25: 25,
  50: 45,
  100: 90,
};

const BLURB_BY_CREDITS: Record<number, string> = {
  25: "Try the flow with a small top-up.",
  50: "Best value for regular practice.",
  100: "Maximum credits per purchase.",
};

const TIER_ORDER: CreditPackTier[] = ["starter", "standard", "premium"];
const TITLE_ORDER = ["Starter", "Standard", "Premium"] as const;

function displayFromPriceMap(packs: Record<string, number>): CreditPackDisplay[] {
  const entries = Object.entries(packs).sort((a, b) => a[1] - b[1]);
  return entries.map(([priceId, credits], i) => ({
    tier: TIER_ORDER[i] ?? "premium",
    priceId,
    credits,
    title: TITLE_ORDER[i] ?? `${credits} credits`,
    priceUsd: USD_BY_CREDITS[credits] ?? credits,
    blurb:
      BLURB_BY_CREDITS[credits] ?? `${credits} credits for your account.`,
  }));
}

/** Price id → credits for `/api/stripe/checkout` validation. */
export function getCheckoutCreditPacks(): Record<string, number> {
  const fromEnv = parseCheckoutPriceCreditsJson();
  if (fromEnv) return fromEnv;
  return getFallbackCreditPacks();
}

/** Rows for the pricing UI (server-derived so Vercel JSON is the single source). */
export function getCheckoutCreditPackDisplay(): CreditPackDisplay[] {
  const fromEnv = parseCheckoutPriceCreditsJson();
  if (fromEnv) return displayFromPriceMap(fromEnv);
  return getFallbackCreditPackDisplay();
}
