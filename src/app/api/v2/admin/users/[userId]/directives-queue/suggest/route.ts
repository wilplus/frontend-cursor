import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/admin/users/[userId]/directives-queue/suggest
 *
 * Ask backend BE-3 to LLM-generate five contextual question
 * suggestions from the user's recent transcript + long-term profile.
 *
 * Body (optional): `{ snippet_id_context?: string }` — soft context
 * hint when the admin is suggesting from a snippet-adjacent view.
 * Backend treats it as a hint, not a filter.
 *
 * Response: `{ rows: [{intent_tag, question}, ...] }` — five
 * proposals, NOT persisted. Frontend pre-fills the form and the
 * admin edits + saves via the canonical POST on the parent route.
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
    const body = await req.json().catch(() => ({}));
    const url = `${backend}/v2/admin/users/${encodeURIComponent(
      params.userId
    )}/directives-queue/suggest`;
    const upstream = await fetch(url, {
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
    console.error("directives-queue/suggest BFF error:", message);
    return NextResponse.json(
      { code: "BFF_THROWN", error: message },
      { status: 500 }
    );
  }
}
