import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/results/[sessionId]/status
 * Fetch the dual-state status for a specific session.
 * Auth required: User can only view their own session.
 *
 * Returns:
 *   - status: "completed" if admin has published results (results_published_at set)
 *   - status: "processing" otherwise
 */
export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
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

    const { data: session, error: sessionError } = await supabase
      .from("v2_sessions")
      .select("id, user_id, status, results_published_at, ai_task_alignment_score, ai_task_alignment_comment, kpi_score")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { code: "NOT_FOUND", error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.user_id !== user.id) {
      return NextResponse.json(
        { code: "FORBIDDEN", error: "You do not have access to this session" },
        { status: 403 }
      );
    }

    // Dual-state: admin must explicitly publish before user sees results
    const isPublished = !!session.results_published_at;
    const status = isPublished ? "completed" : "processing";

    return NextResponse.json(
      {
        status,
        session_id: sessionId,
        created_at: session.results_published_at,
        ...(isPublished && {
          ai_summary: session.ai_task_alignment_comment,
          ai_score: session.ai_task_alignment_score,
          kpi_score: session.kpi_score,
        }),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Results status API error:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}

