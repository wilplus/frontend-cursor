import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: { snippetId: string } },
): Promise<NextResponse> {
  return callBackend(
    `/v2/user/snippets/${encodeURIComponent(params.snippetId)}/confidence-practice`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: (await req.text()) || "{}",
    },
  );
}
