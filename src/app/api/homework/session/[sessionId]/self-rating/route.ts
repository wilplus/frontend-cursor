import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import { requireAuth } from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

/**
 * POST self-rating (1–10) for the session. Optional; does not block report generation or coach email.
 * Body: { "rating": number } (1–10).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const unauth = await requireAuth(req);
  if (unauth) return unauth;

  let body: { rating?: number } = {};
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      body = await req.json();
    }
  } catch {
    // keep defaults
  }

  const rating = typeof body.rating === "number" && body.rating >= 1 && body.rating <= 10
    ? Math.round(body.rating)
    : undefined;

  const { sessionId } = params;
  return proxyJson(
    `/v2/homework/session/${sessionId}/self-rating`,
    { method: "POST", body: rating != null ? { rating } : {} },
    req
  );
}
