import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayLenient, type Failures } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  POST /api/v2/coach/training-imports/<sessionId>/erase                    */
/*       → BE /v2/coach/training-imports/<sessionId>/erase                   */
/*                                                                            */
/*  The founder's Delete: erase an import for good (founder 2026-10-19).    */
/*  Verbatim pass-through; founder-only upstream.                             */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Corpus index unavailable." } },
};
const RELAY = relayLenient();

export async function POST(_req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const token = await getAccessToken();
    if (!token) return failure(FAILURES.unauthenticated!);
    const sessionId = params.sessionId;
    if (!sessionId) {
      return NextResponse.json({ code: "INVALID_SESSION", error: "No import id." }, { status: 400 });
    }
    return await callBackend(`/v2/coach/training-imports/${encodeURIComponent(sessionId)}/erase`, {
      method: "POST", token, failures: FAILURES, relay: RELAY,
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(`coach_training_import_erase.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`, err);
    return NextResponse.json(
      { code: "BFF_THROWN", error: `BFF threw: ${name}: ${message}`, bff_revision: "coach-training-import-erase-v1" },
      { status: 500 },
    );
  }
}
