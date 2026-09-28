import "server-only";
import { NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";
import { isUuid } from "@/lib/uuid";

export const runtime = "nodejs";

/** The operator confirms one project deletion (P1, N8). Creates the
 * one-project purge request; nothing is deleted until an operator runs the
 * double-gated purge script. The backend's admin decorator decides. */
export async function POST(
  _req: Request,
  context: { params: { requestId: string } }
): Promise<NextResponse> {
  const { requestId } = context.params;
  if (!isUuid(requestId)) {
    return NextResponse.json(
      { code: "INVALID_INPUT", error: "Invalid request id" },
      { status: 400 }
    );
  }
  const response = await callBackend(
    `/v2/admin/project-deletions/${encodeURIComponent(requestId)}/confirm`,
    { method: "POST" }
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
