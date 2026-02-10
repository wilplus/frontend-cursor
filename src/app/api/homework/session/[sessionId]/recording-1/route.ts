import type { NextRequest } from "next/server";
import { proxyJson, proxyMultipart } from "@/lib/api/bff";
import {
  useMockHomework,
  requireAuth,
  mockRecording1Response,
} from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const unauth = await requireAuth(req);
  if (unauth) return unauth;

  if (useMockHomework()) {
    return Response.json(mockRecording1Response());
  }

  const { sessionId } = await params;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    let body: { storage_path?: string; duration_seconds?: number } = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const res = await proxyJson(
      `/v2/homework/session/${sessionId}/recording-1`,
      {
        method: "POST",
        body: {
          storage_path: body.storage_path ?? "",
          duration_seconds: body.duration_seconds ?? 0,
        },
      },
      req
    );
    if (res.status === 404) return Response.json(mockRecording1Response());
    return res;
  }

  const formData = await req.formData();
  const res = await proxyMultipart(`/v2/homework/session/${sessionId}/recording-1`, formData, "POST", req);
  if (res.status === 404) {
    return Response.json(mockRecording1Response());
  }
  return res;
}
