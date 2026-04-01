import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import { requireAuth } from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

/** GET report for completed session (step 5): report_text, scores, final_recording with fresh audio_url. */
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const unauth = await requireAuth(req);
  if (unauth) return unauth;

  const sessionId = params?.sessionId;
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "Missing or invalid sessionId" },
      { status: 400 }
    );
  }

  const res = await proxyJson(`/v2/homework/session/${sessionId}/report`, { method: "GET" }, req);
  // So we can tell in Network tab whether this BFF route ran (404 with this header = backend 404)
  res.headers.set("X-Homework-Report-Route", "hit");
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  return res;
}
