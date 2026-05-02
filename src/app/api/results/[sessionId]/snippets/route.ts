import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/results/[sessionId]/snippets
 * Fetch snippets with admin comments for a specific session.
 * Auth required: User can only view their own session's snippets.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    const supabase = await createClient();

    // Get authenticated user
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

    // Fetch session to verify ownership
    const { data: session, error: sessionError } = await supabase
      .from("v2_sessions")
      .select("id, user_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { code: "NOT_FOUND", error: "Session not found" },
        { status: 404 }
      );
    }

    // Verify user owns this session
    if (session.user_id !== user.id) {
      return NextResponse.json(
        { code: "FORBIDDEN", error: "You do not have access to this session" },
        { status: 403 }
      );
    }

    // Fetch snippets with admin comments (only those the admin has labeled)
    const { data: snippets, error: snippetError } = await supabase
      .from("charisma_snippets")
      .select(
        `
        id,
        session_id,
        user_id,
        recording_id,
        start_offset_ms,
        duration_ms,
        audio_segment_path,
        snippet_type,
        admin_comment,
        admin_user_id,
        created_at,
        updated_at
      `
      )
      .eq("session_id", sessionId)
      .not("admin_comment", "is", null)
      .order("start_offset_ms", { ascending: true });

    if (snippetError) {
      console.error("Failed to fetch snippets:", snippetError);
      return NextResponse.json(
        { code: "FETCH_ERROR", error: "Failed to fetch snippets" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        snippets: snippets || [],
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Results API error:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}
