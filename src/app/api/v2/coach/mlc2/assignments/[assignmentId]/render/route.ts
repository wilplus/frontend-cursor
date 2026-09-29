import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/coach/mlc2/assignments/[assignmentId]/render
 *   → BE POST /v2/coach/mlc2/assignments/<assignmentId>/render
 *
 * The legacy coach card's render receipt on the canonical confidence chain
 * (Q2). The browser posts it once per painted card, with the four-identifier
 * handle the queue row carried and its own stable render instance; the
 * backend answers 201 { exposure_id }, which the label PUT then echoes. The
 * backend closes the route (404) unless the writer state is founder_canary.
 *
 *   POST { presentation_id, acknowledgement_token, render_instance_id,
 *          client_rendered_at, client_version, visible_payload_sha256 }
 *        201 { exposure_id }
 *        400 INVALID_INPUT · 404 NOT_FOUND
 *        409 CONFIDENCE_CHAIN_RENDER_NOT_RECORDED
 *
 * Identifiers and timestamps only; nothing here carries a score, a
 * prediction or any text. The Idempotency-Key is the browser's, as on the
 * D5 receipt, so a retried receipt is one server identity.
 */
const UUID = /^[0-9a-fA-F-]{36}$/;

export async function POST(
  request: NextRequest,
  context: { params: { assignmentId: string } },
) {
  const assignmentId = context.params.assignmentId;
  if (!UUID.test(assignmentId)) {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  }
  const idempotency = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotency) {
    return NextResponse.json(
      { code: "INVALID_INPUT", error: "Idempotency-Key is required." },
      { status: 400 },
    );
  }
  return callBackend(
    `/v2/coach/mlc2/assignments/${encodeURIComponent(assignmentId)}/render`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotency,
      },
      body: (await request.text()) || "{}",
    },
  );
}
