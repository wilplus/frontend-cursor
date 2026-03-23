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

async function getAuthorizedAdminContext(
  request: NextRequest,
  params: Promise<{ id: string }>
) {
  const { session, cookieResponse } = await getSessionForRequest(request);
  if (!session) {
    return {
      errorResponse: jsonWithCookies({ error: "Unauthorized" }, { status: 401 }, cookieResponse),
    };
  }

  const { id: userId } = await params;
  const authCheck = await verifyAdminAccess(session.access_token, userId);
  if (!authCheck.ok) {
    const data = await authCheck.json().catch(() => ({ error: "Forbidden" }));
    return {
      errorResponse: jsonWithCookies(data, { status: authCheck.status }, cookieResponse),
    };
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      errorResponse: jsonWithCookies(
        { error: "Supabase admin client is not configured" },
        { status: 500 },
        cookieResponse
      ),
    };
  }

  return { session, cookieResponse, userId, supabase };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getAuthorizedAdminContext(request, params);
  if ("errorResponse" in context) {
    return context.errorResponse;
  }
  const { cookieResponse, userId, supabase } = context;

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

  const hasRealtimeProgress =
    data != null && (data.realtime_level != null || data.realtime_step != null);

  if (hasRealtimeProgress) {
    return jsonWithCookies({ profile: data }, { status: 200 }, cookieResponse);
  }

  const { data: latestSessionSnapshot } = await supabase
    .from("session_sniper_metrics")
    .select("user_id,realtime_level_at_session,realtime_step_at_session,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fallbackProfile =
    latestSessionSnapshot &&
    (latestSessionSnapshot.realtime_level_at_session != null ||
      latestSessionSnapshot.realtime_step_at_session != null)
      ? {
          user_id: latestSessionSnapshot.user_id,
          realtime_level: latestSessionSnapshot.realtime_level_at_session,
          realtime_step: latestSessionSnapshot.realtime_step_at_session,
          updated_at: latestSessionSnapshot.created_at,
        }
      : null;

  return jsonWithCookies(
    { profile: data ?? fallbackProfile ?? null },
    { status: 200 },
    cookieResponse
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getAuthorizedAdminContext(request, params);
  if ("errorResponse" in context) {
    return context.errorResponse;
  }
  const { cookieResponse, userId, supabase } = context;

  const body = await request.json().catch(() => null);
  const realtimeLevel =
    typeof body?.realtime_level === "number" && Number.isInteger(body.realtime_level) && body.realtime_level >= 1
      ? body.realtime_level
      : body?.realtime_level === null
        ? null
        : undefined;
  const realtimeStep =
    typeof body?.realtime_step === "number" && Number.isInteger(body.realtime_step) && body.realtime_step >= 1
      ? body.realtime_step
      : body?.realtime_step === null
        ? null
        : undefined;

  if (realtimeLevel === undefined && realtimeStep === undefined) {
    return jsonWithCookies(
      { error: "realtime_level or realtime_step must be an integer >= 1 or null" },
      { status: 400 },
      cookieResponse
    );
  }

  const { data: existing, error: fetchError } = await supabase
    .from("user_sniper_profile")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    return jsonWithCookies(
      { error: fetchError.message || "Failed to load sniper profile" },
      { status: 500 },
      cookieResponse
    );
  }

  const writePayload: Record<string, number | string | null> = {
    user_id: userId,
  };
  if (realtimeLevel !== undefined) writePayload.realtime_level = realtimeLevel;
  if (realtimeStep !== undefined) writePayload.realtime_step = realtimeStep;

  const { error: writeError } = existing
    ? await supabase.from("user_sniper_profile").update(writePayload).eq("user_id", userId)
    : await supabase.from("user_sniper_profile").insert(writePayload);

  if (writeError) {
    return jsonWithCookies(
      { error: writeError.message || "Failed to update sniper profile" },
      { status: 500 },
      cookieResponse
    );
  }

  const { data: updated, error: updatedError } = await supabase
    .from("user_sniper_profile")
    .select("user_id,realtime_level,realtime_step,sessions_with_pitch_count,realtime_pitch_baseline_st,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (updatedError) {
    return jsonWithCookies(
      { error: updatedError.message || "Failed to load updated sniper profile" },
      { status: 500 },
      cookieResponse
    );
  }

  return jsonWithCookies({ profile: updated ?? null }, { status: 200 }, cookieResponse);
}
