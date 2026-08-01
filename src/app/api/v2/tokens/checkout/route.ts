import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

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
export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ error: "Backend URL not configured" }, { status: 502 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/tokens/checkout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
  } catch (err) {
    console.error("POST /api/v2/tokens/checkout — fetch failed:", err);
    return NextResponse.json({ error: "Checkout service unavailable." }, { status: 502 });
  }

  const text = await upstream.text();
  if (!text) return new NextResponse(null, { status: upstream.status });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: `Unexpected backend response (HTTP ${upstream.status}).` },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }
  return NextResponse.json(data, { status: upstream.status });
}
