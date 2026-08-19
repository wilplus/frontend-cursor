import "server-only";
import { NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { practiceId: string } },
): Promise<NextResponse> {
  return callBackend(
    `/v2/user/confidence-practice/${encodeURIComponent(params.practiceId)}`,
    { method: "GET" },
  );
}
