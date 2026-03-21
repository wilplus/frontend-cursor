import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

export const dynamic = "force-dynamic";

/** Preferred frontend alias for the step-2 question block. Backend still uses /task-block. */
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;
  return proxyJson(`/v2/homework/session/${sessionId}/task-block`, undefined, req);
}
