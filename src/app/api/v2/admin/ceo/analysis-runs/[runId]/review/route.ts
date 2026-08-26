import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: { runId: string } }
): Promise<NextResponse> {
  const response = await callBackend(
    `/v2/admin/ceo/analysis-runs/${encodeURIComponent(context.params.runId)}/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
    }
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
