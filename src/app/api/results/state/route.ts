import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/**
 * GET /api/results/state
 *
 * Distinguishes the three routing states the post-auth flow needs:
 *   - "no_session": the user has zero v2_sessions rows. Send them to /chat
 *                   to record a baseline.
 *   - "processing": at least one v2_sessions row exists but its
 *                   `results_published_at` is null. Show the waiting UI on
 *                   /results.
 *   - "completed":  the most recent session has `results_published_at` set.
 *                   Send them to /results/[session_id] for the snippets.
 *
 * Distinct from /api/results/latest, which only knows about *published*
 * sessions ("completed" vs "no_results") and so cannot tell us whether a
 * user has a session in flight. We query v2_sessions directly via
 * Supabase here for the same reason /api/results/[sessionId]/status does.
 *
 * Response shapes:
 *   200 { kind: "no_session" }
 *   200 { kind: "processing", session_id: string }
 *   200 { kind: "completed",  session_id: string }
 *   401 { code: "UNAUTHENTICATED" }
 *   500 { code: "ERROR" }
 */
export async function GET() {
  try {
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

    const { data: rows, error: queryError } = await supabase
      .from("v2_sessions")
      .select("id, results_published_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (queryError) {
      console.error("/api/results/state — supabase query error:", queryError);
      return NextResponse.json(
        { code: "ERROR", error: "Failed to read session state" },
        { status: 500 }
      );
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ kind: "no_session" }, { status: 200 });
    }

    const latest = rows[0];
    const isPublished = !!latest.results_published_at;
    return NextResponse.json(
      {
        kind: isPublished ? "completed" : "processing",
        session_id: latest.id as string,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("/api/results/state error:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}
