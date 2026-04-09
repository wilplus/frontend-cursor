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
  return proxyAdminWithCodes(request, {
    method: "GET",
    backendPath: `/v2/admin/copilot/students/${encodeURIComponent(studentId)}/audit${qs}`,
  });
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
  // Prefer existing copilot alias when available.
  const primary = await proxyAdminWithCodes(request, {
    method: "PUT",
    backendPath: `/v2/admin/copilot/students/${encodeURIComponent(studentId)}/audit`,
    body,
  });
  if (primary.status !== 404) return primary;

  // Backend canonical route requires session_id in path.
  const sessionId =
    typeof (body as { session_id?: unknown }).session_id === "string"
      ? (body as { session_id?: string }).session_id
      : typeof request.nextUrl.searchParams.get("session_id") === "string"
        ? request.nextUrl.searchParams.get("session_id")
        : null;
  if (!sessionId || !sessionId.trim()) {
    return NextResponse.json(
      {
        code: "SESSION_ID_REQUIRED",
        error: "session_id is required for insight audit fallback route",
      },
      { status: 400 }
    );
  }
  const token = await getV2AccessToken(request);
  if (!token) return NextResponse.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, { status: 401 });
  const backend = getBackendUrl();
  const response = await fetch(
    `${backend}/v2/admin/students/${encodeURIComponent(studentId)}/sessions/${encodeURIComponent(sessionId)}/insight-audit`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const raw = await response.text();
  if (!raw.trim()) {
    return NextResponse.json(
      response.ok
        ? { status: "ok" }
        : { code: `HTTP_${response.status}`, error: response.statusText || "Request failed" },
      { status: response.ok ? 200 : response.status }
    );
  }
  const parsed = JSON.parse(raw);
  return NextResponse.json(parsed, { status: response.status });
}

