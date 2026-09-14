import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/tokens/checkout
 *
 * BFF proxy for the BE's tier checkout. Body `{tier, success_url?, cancel_url?}`
 * → `{checkout_url, checkout_session_id, tier}`, relayed verbatim with its
 * status so the FE can branch the error codes (INVALID_TIER, DISABLED,
 * MISCONFIGURED).
 *
 * THIS REPLACES A DUPLICATE. The FE briefly created these sessions itself
 * (/api/stripe/subscribe), because a grep for a checkout route came up empty —
 * against a stale worktree rather than origin/main. The BE route existed the
 * whole time, and it is the better home by some distance:
 *
 *   - ONE copy of STRIPE_PRICE_TIER_JSON. The FE version needed its own, and
 *     two copies of a price → tier map is exactly how someone pays for Pro and
 *     is granted Starter.
 *   - No STRIPE_SECRET_KEY in the FE at all, and no Stripe SDK dependency.
 *   - The BE deliberately does NOT gate this on TOKEN_PRICING_ENABLED: the flag
 *     governs whether actions are CHARGED, and it must not stop someone paying.
 *     A subscription bought while metering is off still sets the tier.
 *
 * The FE's only remaining job is passing the return URLs, because it owns the
 * routes they point at. The BE's own defaults aim at /account, which this app
 * does not have.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Checkout service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Sign-in is checked before the body is read, as it always was.
  const token = await getAccessToken();
  if (!token) return failure(FAILURES.unauthenticated!);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  return callBackend("/v2/tokens/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    token,
    failures: FAILURES,
    relay: RELAY,
  });
}
