import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  PUT /api/v2/user/snippets/[snippetId]/confidence-agree                     */
/*    → BE PUT /v2/user/snippets/<snippet_id>/confidence-agree                 */
/*                                                                            */
/*  "Do you agree?" on the Confident Voice card (founder 2026-08-15). The same */
/*  ternary body as every other lane — { value: "yes"|"no"|"neutral" } XOR     */
/*  { unrateable: true }, plus note / latency_ms.                              */
/*                                                                            */
/*  A SEPARATE ENDPOINT FROM owner-confidence-label, and the separation is the */
/*  contract rather than a naming choice. That route collects a BLIND rating:  */
/*  it asks before any machine read is shown. This one collects an ANCHORED    */
/*  one — the card has already said "you sounded incredibly confident and      */
/*  natural here" — and the BE stamps `saw_model_output: true` off the route   */
/*  itself, because a body field would let a buggy or replayed client write a  */
/*  false blindness claim from the one surface where it is false. An anchored  */
/*  label is indistinguishable from a blind one once stored, so the corpus     */
/*  cannot be un-poisoned afterwards (I1).                                     */
/*                                                                            */
/*  Which is also why routing the two through one proxy would be wrong: the    */
/*  path is what carries the fact.                                             */
/*                                                                            */
/*  Relayed VERBATIM through callBackend (the single BFF idiom — check:bff):   */
/*  the BE owns validation, because a coerced value fabricates training data.  */
/*  Auth REQUIRED, and the BE ownership-gates the snippet (404 otherwise).     */
/*                                                                            */
/*  Success 200: { saved: true, snippet_id }                                   */
/*  401 UNAUTHENTICATED · 404 not the caller's snippet · 5xx unavailable       */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";
export const maxDuration = 30;

export async function PUT(
  req: NextRequest,
  { params }: { params: { snippetId: string } }
): Promise<NextResponse> {
  const id = encodeURIComponent(params.snippetId);
  const body = await req.text();
  return callBackend(`/v2/user/snippets/${id}/confidence-agree`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body || "{}",
  });
}
