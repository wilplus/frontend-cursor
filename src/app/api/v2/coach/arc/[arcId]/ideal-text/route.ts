import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET/PUT /api/v2/coach/arc/[arcId]/ideal-text
 *
 * BFF proxy — the coach's ONE-BLOCK ideal text (delivery layer). GET returns
 * the auto-assembled draft merged with any saved coach edit; PUT saves the
 * coach's edit. Coach-gated upstream.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Ideal-text service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

async function relay(
  req: NextRequest,
  arcId: string,
  method: "GET" | "PUT"
): Promise<NextResponse> {
  const id = encodeURIComponent(arcId);
  return callBackend(`/v2/coach/arc/${id}/ideal-text`, {
    method,
    ...(method === "PUT"
      ? {
          headers: { "Content-Type": "application/json" },
          body: (await req.text()) || "{}",
        }
      : {}),
    failures: FAILURES,
    relay: RELAY,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  return relay(req, params.arcId, "GET");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  return relay(req, params.arcId, "PUT");
}
