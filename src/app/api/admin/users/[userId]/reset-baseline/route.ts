import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { UserAdminContext } from "@/lib/api/types";

/**
 * POST /api/admin/users/[userId]/reset-baseline
 *
 * Flip the user's `baseline_established` flag back to false so the
 * next session re-runs the EBCP acoustic calibration script
 * (turns 1–4) instead of routing straight into LLM-driven coaching.
 * Used after a hardware change or a long break — both can drift
 * the acoustic profile enough that the cached baseline is no
 * longer valid for normalisation.
 *
 * Same auth/proxy pattern as /admin/user/[userId]/context: legacy
 * proxyJson helper, cookie-based admin session, no /v2/ prefix.
 *
 * Body: none.
 *
 * 200 OK    — flag flipped, returns the updated UserAdminContext
 *             (the frontend uses baseline_established/at from the
 *             response to update local state without a follow-up GET).
 * 401       — admin not signed in
 * 403       — caller isn't an admin
 * 404       — user_id not found
 * 5xx       — backend unavailable
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  const path = `/admin/users/${userId}/reset-baseline`;
  console.log(`[API /admin/users/${userId}/reset-baseline] POST`);
  return proxyJson<undefined, UserAdminContext>(
    path,
    { method: "POST" },
    req
  );
}
