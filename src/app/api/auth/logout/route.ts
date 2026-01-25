import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(_req: NextRequest) {
  const supabase = createServerSupabaseClient();

  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}

