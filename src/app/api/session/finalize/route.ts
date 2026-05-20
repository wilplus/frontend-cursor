import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

const BFF_REVISION = "session-finalize-v1";

/**
 * POST /api/session/finalize
 *
 * Frontend calls this when the cold-start aggregate recording
 * threshold hits 30s, OR the user clicks "Done" — see
 * docs/ARCHITECTURE_SINGLE_SOURCE_OF_TRUTH.md §3. Backend then
 * finalizes the session (writes session-end timestamp, kicks off
 * any post-session pipelines like snippet extraction). Backend
 * does NOT track aggregate duration independently — the frontend
 * is the source of truth for "session is done".
 *
 * Authenticated and guest sessions both go through this endpoint:
 *
 *   • Logged-in user → forwards Authorization bearer + body to backend.
 *   • Guest funnel → no bearer; body must include `guest_session_id`
 *     so backend can look up the session row.
 *
 * Body (every field optional from frontend's POV — backend
 * decides which it needs):
 *   {
 *     guest_session_id?: string | null,
 *     total_duration_seconds?: number,
 *     reason?: "threshold" | "user_done"   // why we're finalizing
 *   }
 *
 * Returns: backend's response shape (typically `{ status: "ok",
 * session_id, results_url? }` — frontend consumes session_id when
 * present and routes to /results, otherwise lets the existing
 * onThresholdReached → /results path do its thing).
 *
 * 5xx — backend unavailable; frontend treats finalize failure as
 *       non-fatal and still routes the user to /results so they're
 *       not stranded on the chat surface.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const backend = getBackendUrl();
    if (!backend) {
      return NextResponse.json(
        { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
        { status: 502 }
      );
    }

    // Bearer is OPTIONAL here — guest funnel uses guest_session_id in
    // the body to identify the session, no auth required.
    const token = await getV2AccessToken(req);

    const body = await req.json().catch(() => ({}));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-bff-revision": BFF_REVISION,
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    // Backend path per SSoT §3:
    // /v2/public/interview/finalize (NOT /v2/session/finalize —
    // that was the pre-Phase-18 path that no longer exists).
    const upstream = await fetch(`${backend}/v2/public/interview/finalize`, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("POST /api/session/finalize error:", name, message, err);
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
