import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getCurrentUserId } from "@/app/api/getAuth";
import {
  getTierPriceMap,
  isPaidTier,
  purchasableTiers,
} from "@/lib/stripe/subscriptionTiers.server";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*  /api/stripe/subscribe — start a monthly plan                              */
/*                                                                            */
/*  The backend already does the FULFILMENT half: its                          */
/*  stripe_subscription_tiers.py handles customer.subscription.created/updated/ */
/*  deleted, maps price → tier, and drops to free when a subscription ends.    */
/*  What it has no route for is CREATING the session, which is exactly what the */
/*  retired credit-pack checkout used to do here. So this closes the loop       */
/*  without waiting on BE work.                                                */
/*                                                                            */
/*  THE CLIENT SENDS A TIER NAME, NEVER A PRICE ID. The old pack route took a  */
/*  price id from the body and whitelisted it; a tier name is strictly safer,   */
/*  because the mapping to money is resolved server-side and a crafted request  */
/*  cannot name a cheaper price than the plan it claims.                        */
/*                                                                            */
/*  BOTH metadata locations are set, and that is load-bearing: the BE reads     */
/*  `metadata.user_id` off the SUBSCRIPTION object, and only                    */
/*  `subscription_data.metadata` lands there. Session-level metadata alone      */
/*  survives the first event and is absent from every later renewal, so the     */
/*  tier would silently stop being maintained. Its own comment says so.         */
/*                                                                            */
/*  It never charges anything itself — Stripe collects, the webhook grants.     */
/* -------------------------------------------------------------------------- */

function appOrigin(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto =
    (req.headers.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() || "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

/** Which plans the wallet may render a button for. Kept on the same route as
 *  the POST so the list and the thing it enables can never disagree. */
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const configured = process.env.STRIPE_SECRET_KEY?.trim() ? purchasableTiers() : [];
  return NextResponse.json({ purchasable: configured });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tier =
    typeof body === "object" && body !== null && "tier" in body
      ? String((body as { tier: unknown }).tier ?? "").trim().toLowerCase()
      : "";
  if (!isPaidTier(tier)) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const priceId = getTierPriceMap()[tier];
  if (!priceId) {
    // Configured nowhere → not for sale. 503 rather than 400: the request was
    // fine, the server just cannot sell this yet.
    return NextResponse.json(
      { error: "That plan isn't available yet." },
      { status: 503 }
    );
  }

  const stripe = new Stripe(secretKey);
  const origin = appOrigin(req);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // Back to the wallet either way. The tier arrives asynchronously via the
      // webhook, so the success screen says "updating" rather than asserting a
      // new balance it cannot yet see.
      success_url: `${origin}/dashboard/pricing?plan=success`,
      cancel_url: `${origin}/dashboard/pricing?plan=cancelled`,
      client_reference_id: userId,
      metadata: { user_id: userId, tier },
      subscription_data: {
        // REQUIRED. This is the copy the BE actually reads on renewals.
        metadata: { user_id: userId, tier },
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502 }
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("POST /api/stripe/subscribe — session create failed:", err);
    return NextResponse.json(
      { error: "Could not start checkout. Try again." },
      { status: 502 }
    );
  }
}
