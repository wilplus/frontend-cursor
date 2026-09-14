import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { backendFetch, getAccessToken } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET(
  request: NextRequest,
  { params }: { params: { bundleId: string; attachmentId: string } },
) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
  const upstream = await backendFetch(
    `/v2/user/confident-moment-bundles/${encodeURIComponent(params.bundleId)}/attachments/${encodeURIComponent(params.attachmentId)}/source-playback`,
    { method: "GET", token, signal: request.signal },
  );
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
