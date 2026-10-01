import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Phase 2 of the after-practice paths (founder 2026-10-01, F1; migration
 *  0408): the speaker's app reports that a bookmark opened or was skipped.
 *  Body `{event, shown}`; the backend records it once per event. */
export async function POST(
  req: NextRequest,
  { params }: { params: { snippetId: string } },
): Promise<NextResponse> {
  return callBackend(
    `/v2/user/snippets/${encodeURIComponent(params.snippetId)}/moment-event`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: (await req.text()) || "{}",
    },
  );
}
