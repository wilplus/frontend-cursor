import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import { useMockHomework, requireAuth } from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

/** POST with { "recording": "1" } or "2" → returns { bucket, storage_path } for Supabase Storage upload. */
export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const unauth = await requireAuth(req);
  if (unauth) return unauth;

  let body: { recording?: string } = {};
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      body = await req.json();
    }
  } catch {
    // keep defaults
  }

  const recording = body.recording === "2" ? "2" : "1";
  const { sessionId } = params;

  if (useMockHomework()) {
    return Response.json({
      bucket: "recordings",
      storage_path: `homework/mock/${sessionId}/recording-${recording}.webm`,
    });
  }

  const res = await proxyJson(
    `/v2/homework/session/${sessionId}/recording-upload-url`,
    { method: "POST", body: { recording } },
    req
  );
  return res;
}
