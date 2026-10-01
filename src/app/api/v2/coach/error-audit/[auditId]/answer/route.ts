import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

// Phase 6a: one blind answer (yes, no, cant_tell), once.
export async function POST(
  req: NextRequest,
  { params }: { params: { auditId: string } },
): Promise<NextResponse> {
  return relayJson(req, `/v2/coach/error-audit/${encodeURIComponent(params.auditId)}/answer`, "POST");
}
