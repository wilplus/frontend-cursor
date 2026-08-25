import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: { projectKey: string } }
): Promise<NextResponse> {
  const body = await request.text();
  const response = await callBackend(
    `/v2/admin/ceo/projects/${encodeURIComponent(
      context.params.projectKey
    )}/view-state`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    }
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
