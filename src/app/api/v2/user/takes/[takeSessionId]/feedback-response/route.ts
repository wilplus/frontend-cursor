import "server-only";
import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { takeSessionId: string } }
) {
  const take = encodeURIComponent(params.takeSessionId);
  return callBackend(`/v2/user/takes/${take}/feedback-response`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: (await req.text()) || "{}",
  });
}
