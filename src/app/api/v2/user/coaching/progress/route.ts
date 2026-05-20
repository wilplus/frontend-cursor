import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * GET /api/v2/user/coaching/progress?snippet_id=<uuid>
 *
 * Per-snippet coaching attempt history + delta for the authenticated
 * user. Drives the "Your progress on this" strip rendered under each
 * SnippetCard on /results.
 *
 * Proxies to backend GET /v2/user/coaching/progress.
 *
 * Success 200 shape:
 *   {
 *     snippet_id,
 *     attempts: Attempt[],   // ordered by attempt_number ascending
 *     delta: { ... } | null  // null when 0–1 attempts
 *   }
 *
 * The frontend treats `attempts: []` as "no strip" and `delta: null`
 * as "show attempt count only" — both are valid and shouldn't 4xx.
 *
 * 400 INVALID_INPUT — missing/malformed snippet_id query param.
 * 401 UNAUTHENTICATED
 * 404 NOT_FOUND — snippet doesn't belong to the caller.
 * 503 — backend unavailable.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

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

    const snippetId = req.nextUrl.searchParams.get("snippet_id");
    if (!snippetId) {
      return NextResponse.json(
        { code: "INVALID_INPUT", error: "`snippet_id` query param required." },
        { status: 400 }
      );
    }

    const upstream = await fetch(
      `${backend}/v2/user/coaching/progress?snippet_id=${encodeURIComponent(
        snippetId
      )}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("GET coaching/progress API error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "user-coaching-progress-v1",
      },
      { status: 500 }
    );
  }
}
