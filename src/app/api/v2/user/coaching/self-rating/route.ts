import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/user/coaching/self-rating
 *
 * Persists the user's 1..10 self-rating for their most-recent (or
 * explicit `attempt_number`) coaching attempt on a snippet. Used by
 * the in-chat rating prompt that appears after turn 1 of a contextual
 * chat — see <ChatInterview/> in src/components/funnel/.
 *
 * Proxies to backend POST /v2/user/coaching/self-rating. The backend
 * accepts EITHER a parsed `rating` (number, 1..10) or a free-text
 * `rating_text` ("I'd say 8"), and returns RATING_UNPARSEABLE (400)
 * when neither form yields a 1..10. We pass either shape through
 * verbatim so the parser stays canonical on the backend.
 *
 * Success 200: { status, snippet_id, attempt_number, self_rating,
 *                self_rating_text, self_rating_submitted_at }
 * 400 INVALID_INPUT | RATING_UNPARSEABLE
 * 401 UNAUTHENTICATED
 * 404 NOT_FOUND — snippet doesn't belong to caller
 * 425 ATTEMPT_NOT_READY — eval daemon hasn't written the row yet;
 *     client retries with backoff (handled in ChatInterview).
 * 503 — backend unavailable
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

    // Forward whatever JSON the client sent — backend is the canonical
    // validator for snippet_id / rating / rating_text shape. Local
    // pre-validation would just duplicate that logic and risk drifting.
    const body = await req.json().catch(() => ({}));

    const upstream = await fetch(`${backend}/v2/user/coaching/self-rating`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("POST self-rating API error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "user-self-rating-v1",
      },
      { status: 500 }
    );
  }
}
