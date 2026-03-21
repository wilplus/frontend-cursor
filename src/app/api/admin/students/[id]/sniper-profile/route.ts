import { NextRequest, NextResponse } from "next/server";
import { copyCookies, getSessionForRequest } from "@/lib/api/bff";
import { getBackendUrl } from "@/app/api/getAuth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function verifyAdminAccess(token: string, userId: string): Promise<Response> {
  const backend = getBackendUrl();
  return fetch(`${backend}/v2/admin/students/${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
}

function jsonWithCookies(body: unknown, init: ResponseInit, cookieResponse: NextResponse) {
  const out = NextResponse.json(body, init);
  copyCookies(cookieResponse, out);
  return out;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, cookieResponse } = await getSessionForRequest(request);
  if (!session) {
    return jsonWithCookies({ error: "Unauthorized" }, { status: 401 }, cookieResponse);
  }

  const { id: userId } = await params;
  const authCheck = await verifyAdminAccess(session.access_token, userId);
  if (!authCheck.ok) {
    const data = await authCheck.json().catch(() => ({ error: "Forbidden" }));
    return jsonWithCookies(data, { status: authCheck.status }, cookieResponse);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return jsonWithCookies(
      { error: "Supabase admin client is not configured" },
      { status: 500 },
      cookieResponse
    );
  }

  const { data, error } = await supabase
    .from("user_sniper_profile")
    .select("user_id,realtime_level,realtime_step,sessions_with_pitch_count,realtime_pitch_baseline_st,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return jsonWithCookies(
      { error: error.message || "Failed to load sniper profile" },
      { status: 500 },
      cookieResponse
    );
  }

  return jsonWithCookies({ profile: data ?? null }, { status: 200 }, cookieResponse);
}
