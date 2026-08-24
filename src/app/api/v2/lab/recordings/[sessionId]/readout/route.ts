import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/lab/recordings/[sessionId]/readout
 *
 * BFF proxy — optional account auth or canonical signed Guest ID. The session
 * UUID is only a coordinate and never an access credential.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const id = encodeURIComponent(params.sessionId);
  const guestOwner = req.headers.get("X-Willab-Guest-Owner");
  return callBackend(`/v2/lab/recordings/${id}/readout`, {
    method: "GET",
    headers: guestOwner ? { "X-Willab-Guest-Owner": guestOwner } : {},
    requireAuth: false,
  });
}
