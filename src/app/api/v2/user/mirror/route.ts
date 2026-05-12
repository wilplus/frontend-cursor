import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * GET /api/v2/user/mirror
 *
 * Returns the user's current "mirror" (an LLM-generated narrative
 * synthesised from their last few coaching attempts) along with a
 * `feature_enabled` flag so the page can hide the button entirely
 * when the feature is gated off — no "coming soon" CTA, just absent.
 *
 * Proxies to backend GET /v2/user/mirror.
 *
 * Success 200:
 *   { feature_enabled: boolean,
 *     mirror: Mirror | null,
 *     generated_at: string | null }
 *
 * Mirror shape (when mirror !== null):
 *   { version, generated_at, model, based_on_attempts,
 *     headline, narrative, observations: string[] }
 *
 * 401 UNAUTHENTICATED
 * 503 — backend unavailable
 */
export async function GET(req: NextRequest) {
  try {
    const backend = getBackendUrl();
    if (!backend) {
      return NextResponse.json(
        { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
        { status: 502 }
      );
    }

    const token = await getV2AccessToken(req);
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Not authenticated" },
        { status: 401 }
      );
    }

    const upstream = await fetch(`${backend}/v2/user/mirror`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("GET mirror API error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "user-mirror-get-v1",
      },
      { status: 500 }
    );
  }
}
