import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/v2/admin/users/[userId]/learning-profile
 * Fetch the user's current learning profile type.
 *
 * PATCH /api/v2/admin/users/[userId]/learning-profile
 * Update the user's learning profile type (e.g., 'Stressor', 'Racer', 'Charismatic', 'Neutral').
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;

    const token = await getV2AccessToken(req);
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Not authenticated" },
        { status: 401 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Try user_admin_context table first (existing admin context)
    const { data, error } = await supabase
      .from("user_admin_context")
      .select("learning_profile")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows, which is fine
      console.error("Fetch learning profile error:", error);
    }

    return NextResponse.json({
      status: "ok",
      learning_profile: data?.learning_profile || null,
    });
  } catch (err) {
    console.error("Learning profile GET error:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;

    const token = await getV2AccessToken(req);
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const learningProfile = body.learning_profile;

    if (typeof learningProfile !== "string") {
      return NextResponse.json(
        { code: "INVALID_INPUT", error: "learning_profile must be a string" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Upsert into user_admin_context
    const { data, error } = await supabase
      .from("user_admin_context")
      .upsert(
        {
          user_id: userId,
          learning_profile: learningProfile,
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Update learning profile error:", error);
      return NextResponse.json(
        { code: "DB_ERROR", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "ok",
      learning_profile: data?.learning_profile || learningProfile,
    });
  } catch (err) {
    console.error("Learning profile PATCH error:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}
