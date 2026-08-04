import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/coach/reflection/[clipId]/verdict
 *
 * BFF proxy for the coach's BLIND verdict on one game clip (F2 §1d).
 * Body: { verdict: "confident" | "not_confident" } — relayed verbatim,
 * validated upstream.
 *
 * A `confident` verdict is what lands the moment in the student's
 * cross-project Confident Voices library — decoys included, since a
 * coach-verified decoy is a coach-verified confident moment (and a logged
 * false-negative for the model). Nothing about that distinction is visible
 * here or upstream of here.
 *
 * The body is NOT coerced. This verdict is the ground-truth half of the
 * three-way agreement matrix; a BFF that "helpfully" fixed a malformed
 * value would fabricate a human judgement no human gave — the same rule the
 * confidence-review and coach-label routes hold.
 *
 *   200 { saved: true } · 400 bad verdict · 401/403 not a coach
 *   404 unknown clip · 502 backend unavailable
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { clipId: string } }
) {
  const body = await req.text();
  return callBackend(
    `/v2/coach/reflection/${encodeURIComponent(params.clipId)}/verdict`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body || "{}",
    }
  );
}
