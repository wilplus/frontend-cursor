import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
 * TODO(backend): wire the corresponding endpoint on the Python service.
 * Until that ships, this BFF will return whatever status the backend
 * gives (404 if the route isn't mounted yet).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { turnId: string } }
) {
  try {
    const turnId = params.turnId;
    const supabase = createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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

    const adminToken = req.headers.get("authorization");
    if (!adminToken) {
      return NextResponse.json(
        { code: "MISSING_AUTH", error: "Missing authorization header" },
        { status: 401 }
      );
    }

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
    const response = await fetch(
      `${backendUrl}/v2/admin/turns/${encodeURIComponent(turnId)}/question`,
      {
        method: "PATCH",
        headers: {
          Authorization: adminToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: body.text }),
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("PATCH turn question API error:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}
