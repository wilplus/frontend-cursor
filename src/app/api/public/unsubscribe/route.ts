import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

const BFF_REVISION = "public-unsubscribe-v1";

/**
 * POST /api/public/unsubscribe
 *
 * Public, token-gated. The token (signed JWT or opaque per backend
 * choice) is generated server-side when the email is built; clicking
 * the unsubscribe link in PostSessionResultsEmail lands the user on
 * /unsubscribe?token=<...>, which POSTs the token to this BFF.
 *
 * No bearer required — the token IS the auth. The backend validates
 * it, derives the user_id, flips the email-preference flag, and
 * returns a small confirmation payload.
 *
 * Body:    { token: string }
 *
 * 200 OK:  { status: "ok", email_obscured?: "j**@gmail.com",
 *            already_unsubscribed?: boolean }
 * 400 INVALID_INPUT      — empty body / missing token
 * 401 INVALID_TOKEN      — bad signature, expired, wrong audience
 * 404 USER_NOT_FOUND     — token decoded but user no longer exists
 * 502/503                — backend unavailable
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: "rethrow",
};
const RELAY = relayLenient();

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { token?: string };
    const unsubscribeToken = typeof body.token === "string" ? body.token.trim() : "";
    if (!unsubscribeToken) {
      return NextResponse.json(
        { code: "INVALID_INPUT", error: "`token` is required" },
        { status: 400 }
      );
    }

    // No bearer — the unsubscribe token IS the auth.
    return await callBackend("/v2/public/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", bff_revision: BFF_REVISION },
      body: JSON.stringify({ token: unsubscribeToken }),
      token: null,
      requireAuth: false,
      failures: FAILURES,
      relay: RELAY,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("POST unsubscribe API error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: BFF_REVISION,
      },
      { status: 500 }
    );
  }
}
