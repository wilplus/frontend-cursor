import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/results/[sessionId]/snippets
 * Fetch non-skipped snippets for a specific session.
 * Auth required: User can only view their own session's snippets.
 *
 * Returns all non-skipped snippets with their metrics, admin comments,
 * transcript, question context, and audio URLs — ready for SnippetCard rendering.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    const supabase = createServerSupabaseClient();

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

    // Fetch session to verify ownership + check publish status
    const { data: session, error: sessionError } = await supabase
      .from("v2_sessions")
      .select("id, user_id, results_published_at")
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

    // Only return snippets if results have been published by admin
    if (!session.results_published_at) {
      return NextResponse.json(
        {
          status: "ok",
          snippets: [],
          published: false,
        },
        { status: 200 }
      );
    }

    // Fetch all non-skipped snippets with full data
    const { data: snippets, error: snippetError } = await supabase
      .from("charisma_snippets")
      .select(
        `
        id,
        session_id,
        recording_id,
        start_offset_ms,
        duration_ms,
        audio_segment_path,
        snippet_type,
        admin_comment,
        transcript,
        turn_number,
        question_text,
        question_tone,
        wpm,
        fillers,
        pause_ms,
        dynamic_db,
        pitch_center,
        energy,
        is_skipped,
        created_at
      `
      )
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .eq("is_skipped", false)
      .order("turn_number", { ascending: true })
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
        published: true,
        snippets: (snippets || []).map((s) => ({
          id: s.id,
          snippet_type: s.snippet_type,
          admin_comment: s.admin_comment,
          audio_url: s.audio_segment_path,
          transcript: s.transcript,
          turn_number: s.turn_number,
          question_text: s.question_text,
          question_tone: s.question_tone,
          duration_ms: s.duration_ms,
          metrics: {
            wpm: s.wpm,
            fillers: s.fillers,
            pause_ms: s.pause_ms,
            dynamic_db: s.dynamic_db,
            pitch_center: s.pitch_center,
            energy: s.energy,
          },
        })),
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
