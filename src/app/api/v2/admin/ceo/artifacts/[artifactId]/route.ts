import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: { artifactId: string } }
): Promise<NextResponse> {
  const response = await callBackend(
    `/v2/admin/ceo/artifacts/${encodeURIComponent(context.params.artifactId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
    }
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
