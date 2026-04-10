import { NextRequest, NextResponse } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  if (!studentId || !studentId.trim()) {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "Missing studentId" },
      { status: 400 }
    );
  }
  const body = (await request.json().catch(() => ({}))) as {
    session_id?: string;
    video_url?: string;
    draft_id?: string;
    idempotency_key?: string;
  };
  const primary = await proxyAdminWithCodes(request, {
    method: "POST",
    backendPath: `/v2/admin/copilot/students/${encodeURIComponent(studentId)}/approve`,
    body,
  });
  if (primary.status !== 404) return primary;

  // Fallback when copilot approve is missing (404): approve-send by draft_id.
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl();

  let draftId =
    typeof body.draft_id === "string" && body.draft_id.trim() ? body.draft_id.trim() : "";

  if (!draftId) {
    const clipsResponse = await fetch(`${backend}/v2/admin/copilot/next-clips`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    const payload = (await clipsResponse.json().catch(() => null)) as
      | { clips?: Array<Record<string, unknown>>; drafts?: Array<Record<string, unknown>> }
      | null;
    const rows = payload
      ? Array.isArray(payload.drafts)
        ? payload.drafts
        : Array.isArray(payload.clips)
          ? payload.clips
          : []
      : [];
    const candidate =
      rows.find((row) => {
        const rowStudent = String(row.student_id ?? row.user_id ?? "");
        if (rowStudent !== studentId) return false;
        if (body.session_id) return String(row.session_id ?? "") === body.session_id;
        return true;
      }) ?? null;
    draftId = candidate ? String(candidate.draft_id ?? candidate.id ?? "") : "";
  }

  if (!draftId) {
    return NextResponse.json(
      { code: "DRAFT_NOT_FOUND", error: "Could not resolve draft_id for approve fallback" },
      { status: 404 }
    );
  }
  const approveSendResponse = await fetch(
    `${backend}/v2/admin/students/${encodeURIComponent(studentId)}/drafts/${encodeURIComponent(draftId)}/approve-send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...(body.session_id ? { session_id: body.session_id } : {}),
        ...(typeof body.idempotency_key === "string" && body.idempotency_key.trim()
          ? { idempotency_key: body.idempotency_key.trim() }
          : {}),
        ...(typeof body.video_url === "string" && body.video_url.trim()
          ? { video_url: body.video_url }
          : {}),
      }),
    }
  );
  const raw = await approveSendResponse.text();
  if (!raw.trim()) {
    return NextResponse.json(
      approveSendResponse.ok
        ? { status: "ok", state: "Ready" }
        : { code: `HTTP_${approveSendResponse.status}`, error: approveSendResponse.statusText || "Request failed" },
      { status: approveSendResponse.ok ? 200 : approveSendResponse.status }
    );
  }
  const parsed = JSON.parse(raw);
  return NextResponse.json(parsed, { status: approveSendResponse.status });
}

