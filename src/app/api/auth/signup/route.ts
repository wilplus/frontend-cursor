import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/auth/signup
 *
 * BFF proxy for native (email + password) user registration. Forwards the
 * request to the Python backend's `POST /v2/auth/signup`, which:
 *   1. Validates `terms_accepted === true` (400 if not)
 *   2. Creates the Supabase user via the admin API
 *   3. Writes a timestamped row to `user_consents` for GDPR compliance
 *   4. Signs in the new user and returns access + refresh tokens
 *
 * The frontend then calls `supabase.auth.setSession()` with the returned
 * tokens so the browser is immediately authenticated without a second
 * round-trip.
 *
 * Expected request body:
 *   { email: string, password: string, name?: string, terms_accepted: true }
 *
 * Forwarded response (201 on success):
 *   { user: { id, email }, access_token, refresh_token, expires_in,
 *     terms_recorded: boolean }
 *
 * Error responses mirror the backend exactly:
 *   400 TERMS_NOT_ACCEPTED — checkbox was not checked
 *   400 INVALID_INPUT      — missing email / weak password
 *   409 EMAIL_IN_USE       — duplicate account
 *   500 SIGNUP_ERROR       — unexpected server error
 *   502 PROXY_ERROR        — couldn't reach backend at all
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Registration service unavailable." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", error: "Body must be JSON." },
      { status: 400 }
    );
  }

  // The Python backend's auth endpoints live under /v2/auth/*. No session:
  // this is where one gets created.
  return callBackend("/v2/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    token: null,
    requireAuth: false,
    failures: FAILURES,
    relay: RELAY,
  });
}
