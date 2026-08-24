import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const session = encodeURIComponent(params.sessionId);
  const guestOwner = req.headers.get("X-Willab-Guest-Owner");
  return callBackend(`/v2/lab/recordings/${session}/retry-processing`, {
    method: "POST",
    headers: guestOwner ? { "X-Willab-Guest-Owner": guestOwner } : {},
    requireAuth: false,
  });
}
