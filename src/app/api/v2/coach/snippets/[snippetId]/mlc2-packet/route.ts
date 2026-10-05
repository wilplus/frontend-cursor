import "server-only";
import { NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/coach/snippets/[snippetId]/mlc2-packet
 *   → BE POST /v2/coach/snippets/<snippetId>/mlc2-packet
 *
 * The walk's Judge screen asks the confidence chain for its blind packet on
 * the moment it just painted (founder 2026-10-05, decisions log N48.5 Q27 A:
 * "the coach walk's blind labels as its judgements"). The backend prepares
 * the packet for this coach when the chain selected the moment and answers
 * the four identifiers, or null: not selected, already rated by this coach,
 * the non-blind side already seen, or the chain dark.
 *
 *   POST {} → 200 { mlc2_blind_review: { review_assignment_id,
 *                    presentation_id, acknowledgement_token,
 *                    visible_payload_sha256 } | null }
 *          · 400 INVALID_INPUT
 *
 * Identifiers only; nothing about the moment, no score, no prediction, no
 * text. The coach sees nothing new.
 */
const UUID = /^[0-9a-fA-F-]{36}$/;

export async function POST(
  _request: Request,
  context: { params: { snippetId: string } },
) {
  const snippetId = context.params.snippetId;
  if (!UUID.test(snippetId)) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  }
  return callBackend(
    `/v2/coach/snippets/${encodeURIComponent(snippetId)}/mlc2-packet`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
  );
}
