import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/v2/admin/snippets/[snippetId]/comment
 * Admin endpoint to update a snippet's comment and type.
 * Proxies to backend POST /v2/admin/snippets/{snippet_id}/comment
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { snippetId: string } }
) {
  try {
    const snippetId = params.snippetId;
    const supabase = await createClient();

    // Check if user is authenticated
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

    // Get request body
    const body = await req.json().catch(() => ({}));

    // Call backend API
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
    const adminToken = req.headers.get("authorization");

    if (!adminToken) {
      return NextResponse.json(
        { code: "MISSING_AUTH", error: "Missing authorization header" },
        { status: 401 }
      );
    }

    const response = await fetch(
      `${backendUrl}/v2/admin/snippets/${snippetId}/comment`,
      {
        method: "POST",
        headers: {
          "Authorization": adminToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        error,
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("Update snippet comment API error:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}
