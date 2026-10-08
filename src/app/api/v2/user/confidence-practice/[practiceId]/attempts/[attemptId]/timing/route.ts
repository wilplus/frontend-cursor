import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 15;

/** Relay the phone's Stop and "answer shown" times for one practise try
 *  (V4 B1.4, founder O5 and V7 A). Measurement only: the backend answers 204
 *  with no body, so nothing about the read reaches the phone (AC-9). */
export async function POST(
  req: NextRequest,
  { params }: { params: { practiceId: string; attemptId: string } },
): Promise<NextResponse> {
  return callBackend(
    `/v2/user/confidence-practice/${encodeURIComponent(params.practiceId)}/attempts/${encodeURIComponent(params.attemptId)}/timing`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: (await req.text()) || "{}",
      relay: relayStrict({ empty: "bare", bareStatuses: [204] }),
    },
  );
}
