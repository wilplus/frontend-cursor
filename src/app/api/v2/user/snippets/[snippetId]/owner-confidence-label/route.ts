import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  PUT /api/v2/user/snippets/[snippetId]/owner-confidence-label               */
/*    → BE PUT /v2/user/snippets/<snippet_id>/owner-confidence-label           */
/*                                                                            */
/*  The ideal-text modal's blind label (founder 2026-08-10: "the modal in     */
/*  the ideal text has an option to label the voice snippet"). The OWNER's    */
/*  lane of the same ternary instrument every other lane writes —             */
/*  { value: "yes"|"no"|"neutral" } XOR { unrateable: true }, plus note /     */
/*  latency_ms. Coach + owner are the two labels that admit a snippet to      */
/*  the game ("min twice labelled").                                          */
/*                                                                            */
/*  Relayed VERBATIM through callBackend (the single BFF idiom — check:bff;   */
/*  the neighbouring snippet proxies only predate the rule): the BE owns      */
/*  validation, because a coerced value would fabricate training data. Auth   */
/*  REQUIRED — callBackend's own 401 — and the BE ownership-gates the         */
/*  snippet to the caller (404 otherwise).                                    */
/*                                                                            */
/*  Success 200: { saved: true, snippet_id }                                  */
/*  401 UNAUTHENTICATED · 404 not the caller's snippet · 5xx unavailable      */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";
export const maxDuration = 30;

export async function PUT(
  req: NextRequest,
  { params }: { params: { snippetId: string } }
): Promise<NextResponse> {
  const id = encodeURIComponent(params.snippetId);
  const body = await req.text();
  return callBackend(`/v2/user/snippets/${id}/owner-confidence-label`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body || "{}",
  });
}
