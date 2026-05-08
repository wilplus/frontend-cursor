import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/app/api/getAuth";

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

  // Resolve via the shared helper that checks BACKEND_URL_INTERNAL,
  // NEXT_PUBLIC_API_URL, NEXT_PUBLIC_BACKEND_URL, and BACKEND_URL in that
  // order. The previous `process.env.NEXT_PUBLIC_BACKEND_URL ?? localhost`
  // pattern fell through to localhost in production (Vercel doesn't have
  // that var by default — only BACKEND_URL_INTERNAL / BACKEND_URL are
  // typically set), making fetch ECONNREFUSE and surface as the generic
  // "Registration service unavailable" 502.
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    console.error("POST /api/auth/signup — backend URL is not configured");
    return NextResponse.json(
      {
        code: "BACKEND_UNAVAILABLE",
        error: "Backend URL is not configured.",
      },
      { status: 502 }
    );
  }

  // The Python backend's auth endpoints live under /v2/auth/* (matches the
  // sibling /v2/auth/merge-session BFF). Earlier this route incorrectly
  // posted to `/signup` at the root, which 404'd / threw and surfaced as
  // a generic "Registration service unavailable" 502 to the user.
  const upstreamUrl = `${backendUrl}/v2/auth/signup`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Network-level failure (DNS, ECONNREFUSED, etc.) — we couldn't even
    // reach the backend. This is genuinely "service unavailable" territory.
    console.error("POST /api/auth/signup — upstream fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Registration service unavailable." },
      { status: 502 }
    );
  }

  // Try to parse JSON. Non-JSON responses (e.g. raw HTML 404 from a wrong
  // path) get a clearer error than the generic 502 catch.
  const text = await upstream.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.error(
      "POST /api/auth/signup — non-JSON upstream response",
      upstream.status,
      text.slice(0, 200)
    );
    return NextResponse.json(
      {
        code: "UPSTREAM_NON_JSON",
        error: `Unexpected backend response (HTTP ${upstream.status}).`,
      },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }

  return NextResponse.json(data, { status: upstream.status });
}
