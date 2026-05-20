import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * PATCH /api/v2/admin/turns/[turnId]/question
 *
 * Admin-only — updates the bot question text for a single interview turn.
 * Used by the editable transcript on the Single User Dashboard so coaches
 * can correct or retune the AI's questions before publishing.
 *
 * Proxies to backend PATCH /v2/admin/turns/{turn_id}/question.
 *
 * Body: { text: string }
 *
 * Previously read `process.env.NEXT_PUBLIC_BACKEND_URL` directly with a
 * `localhost:5000` fallback — that variable is intentionally NOT set on
 * Vercel (production uses BACKEND_URL_INTERNAL / BACKEND_URL via
 * getBackendUrl()), so every admin question-edit silently posted to
 * localhost and 500'd. Same regression pattern as the comment + publish
 * BFFs; routed through the shared helpers to match.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { turnId: string } }
) {
  try {
    const turnId = params.turnId;
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

    const body = (await req.json().catch(() => ({}))) as {
      text?: string | null;
    };
    if (typeof body.text !== "string" || body.text.trim().length === 0) {
      return NextResponse.json(
        { code: "INVALID_INPUT", error: "`text` must be a non-empty string" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${backend}/v2/admin/turns/${encodeURIComponent(turnId)}/question`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: body.text }),
        cache: "no-store",
      }
    );

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("PATCH turn question API error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "turn-question-4c09794+",
      },
      { status: 500 }
    );
  }
}
