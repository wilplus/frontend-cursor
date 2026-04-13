import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getCurrentUserId } from "@/app/api/getAuth";
import { getCheckoutCreditPacks } from "@/lib/stripe/checkoutCreditPacks.server";

export const dynamic = "force-dynamic";

function appOrigin(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = (req.headers.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() || "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
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

  const priceId =
    typeof body === "object" &&
    body !== null &&
    "priceId" in body &&
    typeof (body as { priceId: unknown }).priceId === "string"
      ? (body as { priceId: string }).priceId.trim()
      : "";

  const packs = getCheckoutCreditPacks();
  if (!priceId || packs[priceId] === undefined) {
    return NextResponse.json({ error: "Invalid priceId" }, { status: 400 });
  }

  const stripe = new Stripe(secretKey);
  const origin = appOrigin(req);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?credits=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard?credits=cancelled`,
      metadata: {
        user_id: userId,
        price_id: priceId,
      },
      client_reference_id: userId,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Checkout session missing URL" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe/checkout]", e);
    if (e instanceof Stripe.errors.StripeError) {
      const code = e.statusCode;
      const clientErr = code != null && code >= 400 && code < 500;
      return NextResponse.json(
        { error: e.message },
        { status: clientErr ? code : 502 }
      );
    }
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 502 });
  }
}
