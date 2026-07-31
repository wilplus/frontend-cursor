import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  subscribe — start a monthly plan on Stripe                                 */
/*                                                                            */
/*  Two calls: which plans are for sale, and start checkout for one. The FE     */
/*  never sees or sends a price id, and never touches card details — Stripe      */
/*  collects on its own hosted page and the BE webhook grants the tier.         */
/* -------------------------------------------------------------------------- */

/** Tiers the server can actually sell. Empty when Stripe or the price map is
 *  unconfigured, which is the signal to render NO buy button rather than one
 *  that fails on tap. */
export async function fetchPurchasableTiers(): Promise<string[]> {
  const token = await getAuthToken();
  if (!token) return [];
  try {
    const res = await fetch("/api/stripe/subscribe", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { purchasable?: unknown };
    return Array.isArray(body.purchasable)
      ? body.purchasable.filter((t): t is string => typeof t === "string")
      : [];
  } catch {
    return [];
  }
}

export type StartCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

/** Create the Stripe Checkout session for `tier`. The caller redirects to
 *  `url`; nothing is charged until the user completes Stripe's own page. */
export async function startPlanCheckout(tier: string): Promise<StartCheckoutResult> {
  const token = await getAuthToken();
  if (!token) return { ok: false, message: "Sign in to change your plan." };
  let res: Response;
  try {
    res = await fetch("/api/stripe/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tier }),
    });
  } catch {
    return { ok: false, message: "Couldn't reach the server. Try again." };
  }
  const body = (await res.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;
  if (res.ok && body?.url) return { ok: true, url: body.url };
  return {
    ok: false,
    message: body?.error?.trim() || "Couldn't start checkout. Try again.",
  };
}
