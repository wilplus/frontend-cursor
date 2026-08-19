import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  { params }: { params: { practiceId: string } },
): Promise<NextResponse> {
  return callBackend(
    `/v2/user/confidence-practice/${encodeURIComponent(params.practiceId)}/complete`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: (await req.text()) || "{}",
    },
  );
}
