import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/v2/admin/users/[userId]/snippets
 * Admin endpoint to fetch all snippets for a specific user.
 * Proxies to backend POST /v2/admin/users/{user_id}/snippets
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const supabase = createServerSupabaseClient();

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

    // Get query params for pagination
    const limit = req.nextUrl.searchParams.get("limit") || "100";
    const offset = req.nextUrl.searchParams.get("offset") || "0";

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
      `${backendUrl}/v2/admin/users/${userId}/snippets?limit=${limit}&offset=${offset}`,
      {
        method: "GET",
        headers: {
          "Authorization": adminToken,
          "Content-Type": "application/json",
        },
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
    console.error("Admin snippets API error:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}
