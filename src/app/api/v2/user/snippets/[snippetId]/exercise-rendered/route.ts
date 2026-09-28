import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 30;

/** MLC-3 §3.5: the speaker's app confirms an exercise card actually rendered.
 *  Body `{exercise_id}`; the backend records it once per offer. */
export async function POST(
  req: NextRequest,
  { params }: { params: { snippetId: string } },
): Promise<NextResponse> {
  return callBackend(
    `/v2/user/snippets/${encodeURIComponent(params.snippetId)}/exercise-rendered`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: (await req.text()) || "{}",
    },
  );
}
