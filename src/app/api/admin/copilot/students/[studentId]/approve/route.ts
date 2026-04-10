import { NextRequest, NextResponse } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/** Matches IDs invented in drafts GET fallback when next-clips rows lack draft_id (not valid for approve-send). */
function isSyntheticBffCopilotDraftId(studentId: string, draftId: string): boolean {
  return draftId.startsWith(`${studentId}-draft-`);
}

function rowDraftIdFromNextClipsRow(row: Record<string, unknown>): string {
  const top = row.draft_id ?? row.id;
  if (typeof top === "string" && top.trim()) return top.trim();
  const nested = row.draft;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const d = nested as Record<string, unknown>;
    const inner = d.draft_id ?? d.id;
    if (typeof inner === "string" && inner.trim()) return inner.trim();
  }
  const dp = row.draft_payload;
  if (dp && typeof dp === "object" && !Array.isArray(dp)) {
    const d = dp as Record<string, unknown>;
    const inner = d.draft_id ?? d.id;
    if (typeof inner === "string" && inner.trim()) return inner.trim();
  }
  return "";
}

async function resolveRealDraftIdFromBackendCopilotDrafts(
  backend: string,
  token: string,
  studentId: string,
  sessionId: string | undefined
): Promise<string> {
  const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  const res = await fetch(
    `${backend}/v2/admin/copilot/students/${encodeURIComponent(studentId)}/drafts${qs}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );
  if (!res.ok) return "";
  const data = (await res.json().catch(() => null)) as { drafts?: unknown[] } | null;
  const rows = Array.isArray(data?.drafts) ? data!.drafts! : [];
  const candidates: { id: string; session: string }[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = String(r.id ?? r.draft_id ?? "").trim();
    if (!id || isSyntheticBffCopilotDraftId(studentId, id)) continue;
    const session = String(r.session_id ?? r.sessionId ?? "").trim();
    candidates.push({ id, session });
  }
  if (sessionId) {
    const exact = candidates.find((c) => c.session === sessionId);
    if (exact) return exact.id;
  }
  return candidates[0]?.id ?? "";
}

async function postApproveSendWithPathFallback(
  backend: string,
  token: string,
  studentId: string,
  draftId: string,
  jsonBody: Record<string, unknown>
): Promise<Response> {
  const paths = [
    `/v2/admin/students/${encodeURIComponent(studentId)}/drafts/${encodeURIComponent(draftId)}/approve-send`,
    `/v2/admin/copilot/students/${encodeURIComponent(studentId)}/drafts/${encodeURIComponent(draftId)}/approve-send`,
  ];
  let last: Response | null = null;
  for (const p of paths) {
    const res = await fetch(`${backend}${p}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(jsonBody),
    });
    last = res;
    if (res.status !== 404) return res;
  }
  return last!;
}

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

  // Fallback when copilot approve is missing (404): approve-send by real draft_id.
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl();

  let draftId =
    typeof body.draft_id === "string" && body.draft_id.trim() ? body.draft_id.trim() : "";
  if (draftId && isSyntheticBffCopilotDraftId(studentId, draftId)) {
    draftId = "";
  }

  if (!draftId) {
    draftId = await resolveRealDraftIdFromBackendCopilotDrafts(
      backend,
      token,
      studentId,
      typeof body.session_id === "string" && body.session_id.trim() ? body.session_id.trim() : undefined
    );
  }

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
    if (candidate) {
      const fromRow = rowDraftIdFromNextClipsRow(candidate as Record<string, unknown>);
      if (fromRow && !isSyntheticBffCopilotDraftId(studentId, fromRow)) {
        draftId = fromRow;
      }
    }
  }

  if (!draftId) {
    return NextResponse.json(
      {
        code: "DRAFT_NOT_FOUND",
        error:
          "Could not resolve a database draft id for approve-send. The Training Studio draft list may be using placeholder ids; ensure the backend exposes GET .../copilot/students/:id/drafts or next-clips rows include draft_id.",
      },
      { status: 404 }
    );
  }

  const approveJson = {
    ...(body.session_id ? { session_id: body.session_id } : {}),
    ...(typeof body.idempotency_key === "string" && body.idempotency_key.trim()
      ? { idempotency_key: body.idempotency_key.trim() }
      : {}),
    ...(typeof body.video_url === "string" && body.video_url.trim()
      ? { video_url: body.video_url }
      : {}),
  };

  const approveSendResponse = await postApproveSendWithPathFallback(
    backend,
    token,
    studentId,
    draftId,
    approveJson
  );

  const raw = await approveSendResponse.text();
  if (!raw.trim()) {
    return NextResponse.json(
      approveSendResponse.ok
        ? { status: "ok", state: "Ready" }
        : {
            code: `HTTP_${approveSendResponse.status}`,
            error: approveSendResponse.statusText || "Request failed",
          },
      { status: approveSendResponse.ok ? 200 : approveSendResponse.status }
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      {
        code: "INVALID_BACKEND_RESPONSE",
        error: "approve-send returned non-JSON",
        details: { raw: raw.slice(0, 500) },
      },
      { status: 502 }
    );
  }
  return NextResponse.json(parsed, { status: approveSendResponse.status });
}
