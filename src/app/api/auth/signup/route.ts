import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/signup
 *
 * BFF proxy for user registration. Forwards the request to the Python
 * backend, which:
 *   1. Validates that `terms_accepted === true` (400 if not)
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
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const backendUrl = (
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000"
    ).replace(/\/$/, "");

    const upstream = await fetch(`${backendUrl}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error("POST /api/auth/signup error:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Registration service unavailable." },
      { status: 502 }
    );
  }
}
