import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/onboarding/opener/start
 *
 * BFF proxy for the dad-joke onboarding opener (Task T2).
 * Works for anonymous AND authenticated users — BE endpoint requires
 * no auth. Authorization header is included when a token exists
 * (logged-in users) but omitted for anonymous visitors.
 *
 * Success 200:
 *   { stage: "setup", joke_id, frame, setup }
 *
 * 204 No Content — silent skip:
 *   Table missing (pre-migration) OR no active jokes. FE skips the
 *   opener entirely and goes straight to the first real question.
 *   Designed so FE can ship before the migration runs on Supabase.
 *
 * The BE catches unexpected errors and downgrades to 204, so FE only
 * sees 200 or 204 in practice. Any non-200 is treated as "skip".
 */
export async function POST(req: NextRequest) {
  // Auth is optional — anonymous visitors don't have a token and
  // that's fine. Only include the header when a token is available.
  const token = await getV2AccessToken(req);

  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/onboarding/opener/start`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
  } catch (err) {
    console.error("POST /api/v2/onboarding/opener/start — fetch failed:", err);
    // Degrade to 204 (silent skip) on proxy failure — the user still gets
    // onboarding, just without the opener.
    return new NextResponse(null, { status: 204 });
  }

  // 204 has no body — pass through.
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  // Unexpected BE errors degrade to 204 (per the contract — "treat any
  // non-200 as skip"). Logged at WARN so infra can see skips without
  // alerting on them (they're expected during rolling migration deploys).
  if (!upstream.ok) {
    console.warn(
      `POST /api/v2/onboarding/opener/start — BE returned ${upstream.status}; degrading to 204`
    );
    return new NextResponse(null, { status: 204 });
  }

  const text = await upstream.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      console.warn("POST /api/v2/onboarding/opener/start — non-JSON 200; degrading to 204");
      return new NextResponse(null, { status: 204 });
    }
  }
  return NextResponse.json(data, { status: 200 });
}
