import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: { featureId: string } }
): Promise<NextResponse> {
  const response = await callBackend(
    `/v2/admin/ceo/features/${encodeURIComponent(context.params.featureId)}/sources`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
    }
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
