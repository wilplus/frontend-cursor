import { NextRequest, NextResponse } from "next/server";
import { relayTokensGet } from "../../proxy";

export const runtime = "nodejs";

/**
 * GET /api/v2/tokens/arc/[arcId]
 *
 * Per-arc charge state + prices for the actions that are charged ONCE PER ARC
 * (`ref_id = arc_id`): insights and moment_explanation.
 *
 * This is what makes a price on those triggers honest. They are idempotent, so
 * the first use costs and every repeat is free — a static label would be right
 * once and wrong forever after, and a stale price on a control is worse than
 * no price because people act on it. Render the price only when
 * `charged[action] === false`.
 *
 * The lookup NEVER WRITES (pinned by a BE test). That is the whole premise:
 * if checking a price could charge, it could not be read before rendering.
 * Scoped to the caller BE-side — an arc they do not own reads all-false rather
 * than confirming it exists.
 *
 * NOT for `chat`, which has no `ref_id` and is deliberately repeatable. Per-arc
 * and per-turn are different shapes and must not share this logic.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { arcId: string } }
): Promise<NextResponse> {
  return relayTokensGet(req, `arc/${encodeURIComponent(params.arcId)}`);
}
