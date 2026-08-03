import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/* -------------------------------------------------------------------------- */
/*  POST /api/v2/user/snippets/[snippetId]/confidence-review                   */
/*    → BE POST /v2/user/snippets/<snippet_id>/confidence-review               */
/*                                                                            */
/*  The peer-review validation loop (founder pivot, 2026-08-03): a user/peer   */
/*  flags whether the AI's confidence read on this piece was correct. This     */
/*  replaces the deleted stress-recognition lane and its legacy                */
/*  `user_label: "charisma" | "stress"` route.                                 */
/*                                                                            */
/*  Body: { ai_correct: boolean, model_version?: string }                      */
/*    `ai_correct: true`  → the AI's confidence choice was right.              */
/*    `ai_correct: false` → it was wrong.                                      */
/*                                                                            */
/*  The body is relayed VERBATIM — the BE owns validation, and that matters    */
/*  here exactly as it does on the coach confidence-label route: `ai_correct`  */
/*  must be a real JSON boolean and `"true"` is a 400, not a coercion. These   */
/*  flags are routed into the recogniser's retraining corpus as ground-truth   */
/*  human labels (provenance-separated from the blind coach labels), so a BFF  */
/*  that "helpfully" coerced junk would fabricate training data.               */
/*                                                                            */
/*  Auth REQUIRED — a peer label must be attributable so re-labelling          */
/*  replaces THIS reviewer's flag instead of appending duplicates.             */
/*                                                                            */
/*  Success 200: { saved: true, snippet_id, ai_correct }                       */
/*  401 UNAUTHENTICATED · 5xx backend unavailable                              */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: { snippetId: string } }
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

    const id = encodeURIComponent(params.snippetId);
    const body = await req.text();

    let upstream: Response;
    try {
      upstream = await fetch(
        `${backend}/v2/user/snippets/${id}/confidence-review`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: body || "{}",
          cache: "no-store",
        }
      );
    } catch (err) {
      console.error("confidence_review.bff_thrown surface=fe-bff", err);
      return NextResponse.json(
        { code: "PROXY_ERROR", error: "Review service unavailable." },
        { status: 502 }
      );
    }

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error(
      `confidence_review.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "confidence-review-v1",
      },
      { status: 500 }
    );
  }
}
