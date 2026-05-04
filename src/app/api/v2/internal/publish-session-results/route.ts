import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/v2/internal/publish-session-results
 * Admin endpoint to publish (email) results for a session.
 * Proxies to backend POST /v2/internal/publish-session-results
 */
export async function POST(req: NextRequest) {
  try {
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
      `${backendUrl}/v2/internal/publish-session-results`,
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
    console.error("Publish session results API error:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}
