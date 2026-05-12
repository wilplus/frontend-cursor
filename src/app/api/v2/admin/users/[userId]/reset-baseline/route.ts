import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/admin/users/[userId]/reset-baseline
 *
 * Force the user's `baseline_established` flag back to false so the
 * next session re-runs the EBCP acoustic calibration script (turns
 * 1–4) instead of routing straight into LLM-driven coaching. Used
 * after a hardware change or a long break — both of which can drift
 * the acoustic profile enough that the cached baseline is no longer
 * valid for normalisation.
 *
 * Proxies to backend POST /v2/admin/users/<id>/reset-baseline.
 *
 * Body: none.
 *
 * 200 OK     — flag flipped, returns `{ status, user_id, ... }`
 * 401        — admin not signed in
 * 403        — caller isn't an admin
 * 404        — user_id not found
 * 502/503    — backend unavailable
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    const upstream = await fetch(
      `${backend}/v2/admin/users/${encodeURIComponent(params.userId)}/reset-baseline`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: "{}",
        cache: "no-store",
      }
    );

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("POST reset-baseline API error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "admin-reset-baseline-v1",
      },
      { status: 500 }
    );
  }
}
