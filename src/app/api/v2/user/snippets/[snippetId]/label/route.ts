import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/user/snippets/[snippetId]/label
 *
 * User-facing snippet label endpoint. Used by the in-chat review flow
 * when the user taps an ActionBubble option (e.g. [YES, it's Charisma]
 * / [NO]) to confirm or correct the admin's snippet labelling.
 *
 * Distinct from /api/admin/charisma-snippets/[snippetId]/label and
 * /api/admin/stress-snippets/[snippetId]/label, which are admin-only
 * tooling that mutates the canonical snippet_type. This endpoint
 * records the user's perceived label as separate provenance so the
 * coach can learn from disagreements without overwriting admin work.
 *
 * Proxies to backend POST /v2/user/snippets/<id>/label.
 *
 * Body: { user_label: "charisma" | "stress" }
 * Success 200: { status: "ok", snippet_id, user_label }
 * 401 UNAUTHENTICATED
 * 5xx — backend unavailable
 */
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

    const body = await req.json().catch(() => ({}));
    const id = encodeURIComponent(params.snippetId);

    const upstream = await fetch(`${backend}/v2/user/snippets/${id}/label`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("POST user snippet label error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "user-snippet-label-v1",
      },
      { status: 500 }
    );
  }
}
