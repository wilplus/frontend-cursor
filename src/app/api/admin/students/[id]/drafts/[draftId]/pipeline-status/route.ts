import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; draftId: string }> }
) {
  const { id, draftId } = await params;
  if (!id || !id.trim()) {
    return NextResponse.json({ code: "BAD_REQUEST", error: "Missing id" }, { status: 400 });
  }
  if (!draftId || !draftId.trim()) {
    return NextResponse.json({ code: "BAD_REQUEST", error: "Missing draftId" }, { status: 400 });
  }
  const qs = request.nextUrl.search || "";
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl();
  const paths = [
    `/v2/admin/students/${encodeURIComponent(id)}/drafts/${encodeURIComponent(draftId)}/pipeline-status${qs}`,
    `/v2/admin/copilot/students/${encodeURIComponent(id)}/drafts/${encodeURIComponent(draftId)}/pipeline-status${qs}`,
  ];

  let lastStatus = 502;
  let lastPayload: unknown = { code: "UPSTREAM_FETCH_FAILED", error: "Failed to fetch pipeline status" };
  for (const path of paths) {
    try {
      const response = await fetch(`${backend}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      const raw = await response.text();
      const parsed = raw.trim() ? JSON.parse(raw) : {};
      if (response.status === 404) {
        lastStatus = 404;
        lastPayload = parsed;
        continue;
      }
      return NextResponse.json(parsed, { status: response.status });
    } catch (error) {
      lastStatus = 502;
      lastPayload = {
        code: "UPSTREAM_FETCH_FAILED",
        error: error instanceof Error ? error.message : "Failed to fetch pipeline status",
      };
    }
  }

  return NextResponse.json(lastPayload, { status: lastStatus });
}

