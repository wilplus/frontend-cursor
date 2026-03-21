import { NextRequest, NextResponse } from "next/server";
import { copyCookies, getSessionForRequest } from "@/lib/api/bff";
import { getBackendUrl } from "@/app/api/getAuth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_RUBRIC_VERSION = "v1";
const VALID_OVERALL_QUALITIES = new Set(["good", "bad", "unclear"]);

type ReviewRow = {
  id: string;
  session_id: string;
  recording_id: string | null;
  reviewer_id: string;
  overall_quality: "good" | "bad" | "unclear";
  confidence_score: number;
  coach_style_score: number;
  notes: string | null;
  rubric_version: string;
  created_at: string;
  updated_at: string;
};

async function verifyAdminAccess(token: string, userId: string): Promise<Response> {
  const backend = getBackendUrl();
  const url = `${backend}/v2/admin/students/${userId}`;
  return fetch(url, {
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
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const { session, cookieResponse } = await getSessionForRequest(request);
  if (!session) {
    return jsonWithCookies({ error: "Unauthorized" }, { status: 401 }, cookieResponse);
  }

  const { id: userId, sessionId } = await params;
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
    .from("recording_reviews")
    .select("*")
    .eq("session_id", sessionId)
    .eq("rubric_version", DEFAULT_RUBRIC_VERSION)
    .maybeSingle<ReviewRow>();

  if (error) {
    return jsonWithCookies(
      { error: error.message || "Failed to load review" },
      { status: 500 },
      cookieResponse
    );
  }

  return jsonWithCookies({ review: data ?? null }, { status: 200 }, cookieResponse);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const { session, cookieResponse } = await getSessionForRequest(request);
  if (!session) {
    return jsonWithCookies({ error: "Unauthorized" }, { status: 401 }, cookieResponse);
  }

  const { id: userId, sessionId } = await params;
  const authCheck = await verifyAdminAccess(session.access_token, userId);
  if (!authCheck.ok) {
    const data = await authCheck.json().catch(() => ({ error: "Forbidden" }));
    return jsonWithCookies(data, { status: authCheck.status }, cookieResponse);
  }

  const body = await request.json().catch(() => null);
  const overallQuality =
    typeof body?.overall_quality === "string" ? body.overall_quality.trim().toLowerCase() : "";
  const confidenceScore = body?.confidence_score;
  const coachStyleScore = body?.coach_style_score;
  const notesRaw = body?.notes;
  const recordingIdRaw = body?.recording_id;
  const rubricVersionRaw = body?.rubric_version;

  if (!VALID_OVERALL_QUALITIES.has(overallQuality)) {
    return jsonWithCookies(
      { error: "overall_quality must be one of: good, bad, unclear" },
      { status: 400 },
      cookieResponse
    );
  }
  if (
    typeof confidenceScore !== "number" ||
    !Number.isInteger(confidenceScore) ||
    confidenceScore < 1 ||
    confidenceScore > 5
  ) {
    return jsonWithCookies(
      { error: "confidence_score must be an integer between 1 and 5" },
      { status: 400 },
      cookieResponse
    );
  }
  if (
    typeof coachStyleScore !== "number" ||
    !Number.isInteger(coachStyleScore) ||
    coachStyleScore < 1 ||
    coachStyleScore > 10
  ) {
    return jsonWithCookies(
      { error: "coach_style_score must be an integer between 1 and 10" },
      { status: 400 },
      cookieResponse
    );
  }

  const notes =
    typeof notesRaw === "string"
      ? notesRaw.trim() || null
      : notesRaw == null
        ? null
        : undefined;
  if (notes === undefined) {
    return jsonWithCookies(
      { error: "notes must be a string or null" },
      { status: 400 },
      cookieResponse
    );
  }

  const recordingId =
    typeof recordingIdRaw === "string"
      ? recordingIdRaw.trim() || null
      : recordingIdRaw == null
        ? null
        : undefined;
  if (recordingId === undefined) {
    return jsonWithCookies(
      { error: "recording_id must be a string or null" },
      { status: 400 },
      cookieResponse
    );
  }

  const rubricVersion =
    typeof rubricVersionRaw === "string" && rubricVersionRaw.trim()
      ? rubricVersionRaw.trim()
      : DEFAULT_RUBRIC_VERSION;

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return jsonWithCookies(
      { error: "Supabase admin client is not configured" },
      { status: 500 },
      cookieResponse
    );
  }

  const payload = {
    session_id: sessionId,
    recording_id: recordingId,
    reviewer_id: session.user.id,
    overall_quality: overallQuality,
    confidence_score: confidenceScore,
    coach_style_score: coachStyleScore,
    notes,
    rubric_version: rubricVersion,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("recording_reviews")
    .upsert(payload, { onConflict: "session_id,rubric_version" })
    .select("*")
    .single<ReviewRow>();

  if (error) {
    return jsonWithCookies(
      { error: error.message || "Failed to save review" },
      { status: 500 },
      cookieResponse
    );
  }

  return jsonWithCookies({ status: "ok", review: data }, { status: 200 }, cookieResponse);
}
