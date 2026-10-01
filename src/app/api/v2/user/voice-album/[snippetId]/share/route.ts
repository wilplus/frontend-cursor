import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Phase 4 (F3): lend a Voice Album moment to other ears, or take it back. */
export async function PUT(
  req: NextRequest,
  { params }: { params: { snippetId: string } },
): Promise<NextResponse> {
  return relayJson(req, `/v2/user/voice-album/${encodeURIComponent(params.snippetId)}/share`, "PUT");
}
