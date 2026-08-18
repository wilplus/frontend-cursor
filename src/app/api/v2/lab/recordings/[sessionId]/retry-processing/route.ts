import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const session = encodeURIComponent(params.sessionId);
  return callBackend(`/v2/lab/recordings/${session}/retry-processing`, {
    method: "POST",
    requireAuth: false,
  });
}
