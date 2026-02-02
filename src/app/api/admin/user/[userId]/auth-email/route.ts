import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  if (!userId?.trim()) {
    return NextResponse.json({ email: null }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { email: null, error: "Service role not configured" },
      { status: 503 }
    );
  }
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) {
      console.error("[API auth-email] getUserById error:", error.message);
      return NextResponse.json({ email: null }, { status: 200 });
    }
    const email = data?.user?.email ?? null;
    return NextResponse.json({ email });
  } catch (err) {
    console.error("[API auth-email] Error:", err);
    return NextResponse.json({ email: null }, { status: 500 });
  }
}
