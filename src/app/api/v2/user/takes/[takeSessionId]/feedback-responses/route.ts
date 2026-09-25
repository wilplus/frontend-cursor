import "server-only";
import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** The owner's own answers on their Take (the answered bookmark, Q19 A). */
export async function GET(
  req: NextRequest,
  { params }: { params: { takeSessionId: string } }
) {
  void req;
  const take = encodeURIComponent(params.takeSessionId);
  return callBackend(`/v2/user/takes/${take}/feedback-responses`, {
    method: "GET",
  });
}
