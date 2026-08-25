import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: { projectKey: string } }
): Promise<NextResponse> {
  const response = await callBackend(
    `/v2/admin/ceo/projects/${encodeURIComponent(context.params.projectKey)}/features`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
    }
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
