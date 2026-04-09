import { NextRequest, NextResponse } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

function badRequest(message: string) {
  return NextResponse.json({ code: "BAD_REQUEST", error: message }, { status: 400 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  if (!studentId || !studentId.trim()) return badRequest("Missing studentId");
  const qs = request.nextUrl.search || "";
  const primary = await proxyAdminWithCodes(request, {
    method: "GET",
    backendPath: `/v2/admin/copilot/students/${encodeURIComponent(studentId)}/drafts${qs}`,
  });
  if (primary.status !== 404) return primary;

  // Fallback: derive student's rows from /copilot/next-clips dump.
  const token = await getV2AccessToken(request);
  if (!token) return NextResponse.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, { status: 401 });
  const backend = getBackendUrl();
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const nextClipsResponse = await fetch(`${backend}/v2/admin/copilot/next-clips`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const payload = (await nextClipsResponse.json().catch(() => null)) as
    | { clips?: Array<Record<string, unknown>>; drafts?: Array<Record<string, unknown>> }
    | null;
  if (!nextClipsResponse.ok || !payload) {
    return NextResponse.json(
      { code: "COPILOT_DRAFTS_UNAVAILABLE", error: "Copilot per-student drafts endpoint is unavailable" },
      { status: 501 }
    );
  }
  const rows = Array.isArray(payload.drafts)
    ? payload.drafts
    : Array.isArray(payload.clips)
      ? payload.clips
      : [];
  const drafts = rows
    .filter((row) => {
      const rowStudent = String(row.student_id ?? row.user_id ?? "");
      if (rowStudent !== studentId) return false;
      if (sessionId) {
        const rowSession = String(row.session_id ?? "");
        return rowSession === sessionId;
      }
      return true;
    })
    .map((row, index) => ({
      id: String(row.draft_id ?? row.id ?? `${studentId}-draft-${index}`),
      student_id: String(row.student_id ?? row.user_id ?? studentId),
      session_id: typeof row.session_id === "string" ? row.session_id : null,
      status: String(row.status ?? "Draft"),
      ai_insight: typeof row.ai_insight === "string" ? row.ai_insight : null,
      corrected_insight: typeof row.corrected_insight === "string" ? row.corrected_insight : null,
      good_as_is: typeof row.good_as_is === "boolean" ? row.good_as_is : undefined,
      grade_draft:
        typeof row.grade_draft === "number" ? row.grade_draft : null,
      comment_draft: typeof row.comment_draft === "string" ? row.comment_draft : null,
      task_draft: typeof row.task_draft === "string" ? row.task_draft : null,
      email_draft: typeof row.email_draft === "string" ? row.email_draft : null,
      script_draft: typeof row.script_draft === "string" ? row.script_draft : null,
      metadata:
        row.draft_payload && typeof row.draft_payload === "object"
          ? (row.draft_payload as Record<string, unknown>)
          : row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : null,
    }));
  return NextResponse.json({ drafts });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  if (!studentId || !studentId.trim()) return badRequest("Missing studentId");
  const body = await request.json().catch(() => null);
  if (body == null || typeof body !== "object") {
    return badRequest("Invalid JSON body");
  }
  return proxyAdminWithCodes(request, {
    method: "PUT",
    backendPath: `/v2/admin/copilot/students/${encodeURIComponent(studentId)}/drafts`,
    body,
  });
}

