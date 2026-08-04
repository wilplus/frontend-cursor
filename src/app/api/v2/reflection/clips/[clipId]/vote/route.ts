import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/reflection/clips/[clipId]/vote
 *
 * BFF proxy for the user's game vote (F2 §1c). Body: { vote: "best" |
 * "not_this" } — validated upstream; a re-vote overwrites (idempotent).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { clipId: string } }
) {
  const body = await req.text();
  return callBackend(
    `/v2/reflection/clips/${encodeURIComponent(params.clipId)}/vote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }
  );
}
