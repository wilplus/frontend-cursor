import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

const BFF_REVISION = "user-self-rating-v2";

/**
 * POST /api/user/coaching/self-rating
 *
 * Persists the user's 1..10 self-rating for their most-recent
 * coaching attempt on a snippet. Wired to the in-chat "vibe check"
 * composer that appears after turn 1 of a contextual chat — see
 * <ChatInterview/> in src/components/funnel/.
 *
 * Proxies to backend POST /v2/user/coaching/self-rating. Forwards
 * the body verbatim (the backend is the canonical rating_text
 * parser; local pre-validation would just risk drifting). Sends the
 * `bff_revision` header so backend + frontend logs can be correlated
 * to a specific BFF version when a regression rolls out.
 *
 * Success 200: { status, snippet_id, attempt_number, self_rating,
 *                self_rating_text, self_rating_submitted_at }
 * 400 INVALID_INPUT | RATING_UNPARSEABLE
 *     RATING_UNPARSEABLE → frontend shows the inline "I didn't
 *     catch a number — could you try again with just 1–10?" bubble
 *     and re-arms the composer.
 * 401 UNAUTHENTICATED
 * 404 NOT_FOUND — snippet doesn't belong to caller
 * 425 ATTEMPT_NOT_READY — eval daemon hasn't written the row yet;
 *     client retries at +2s, +5s, then soft-fails.
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

    const body = await req.json().catch(() => ({}));

    const upstream = await fetch(`${backend}/v2/user/coaching/self-rating`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        bff_revision: BFF_REVISION,
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
        bff_revision: BFF_REVISION,
      },
      { status: 500 }
    );
  }
}
