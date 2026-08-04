import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/lab/recordings/[sessionId]/readout
 *
 * BFF proxy — the GUEST readout re-read (BE-1, root of bugs 4 & 6). Optional
 * auth: an unclaimed (user_id IS NULL) lab session's readout is public via its
 * unguessable UUID (the same trust model as the rest of the guest funnel); a
 * claimed session requires its owner and 404s otherwise. Forwards status +
 * body faithfully — the FE client owns the envelope shape.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const id = encodeURIComponent(params.sessionId);
  return callBackend(`/v2/lab/recordings/${id}/readout`, {
    method: "GET",
    requireAuth: false,
  });
}
