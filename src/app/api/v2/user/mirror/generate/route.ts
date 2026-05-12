import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/user/mirror/generate
 *
 * Asks the backend LLM to (re)synthesise the user's coaching mirror.
 * Body is empty — the backend reads the user's own attempt history.
 *
 * Proxies to backend POST /v2/user/mirror/generate.
 *
 * Success 200: { mirror, generated_at }
 *
 * Error codes the frontend MirrorCard maps to user-facing copy:
 *   409 NOT_ENOUGH_DATA   — "Keep practising — I need at least 3
 *                            attempts before I can tell you what I see."
 *   409 PROFILE_MISSING   — "Record one coaching answer first."
 *   503 LLM_UNAVAILABLE   — "Coach is offline — try again later."
 *   502 LLM_ERROR         — "Something glitched, try again in a moment."
 *   500 PERSIST_FAILED    — "Generated but couldn't save; retry."
 *   503 FEATURE_DISABLED  — feature flag flipped off mid-session;
 *                            the page should hide the button retroactively.
 */
export async function POST(req: NextRequest) {
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

    // The backend reads the caller's user_id from the bearer; we pass
    // an empty body to keep the contract explicit (still hands the
    // backend a Content-Length so it doesn't 400 on accidental
    // chunked encoding from Next.js's fetch internals).
    const upstream = await fetch(`${backend}/v2/user/mirror/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "{}",
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("POST mirror/generate API error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "user-mirror-generate-v1",
      },
      { status: 500 }
    );
  }
}
