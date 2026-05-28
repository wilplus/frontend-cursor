import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { AdminUserContextPayload } from "@/lib/api/admin-client";

/**
 * BFF: /api/admin/user/[userId]/context
 *
 * Proxies to the Phase 12/13 multi-session admin context endpoint:
 *   GET  /v2/admin/user/<id>/context
 *   PUT  /v2/admin/user/<id>/context
 *
 * IMPORTANT path convention (do NOT normalise — see catch-up doc §1):
 *   • backend uses SINGULAR `/admin/user/...` for this endpoint
 *   • backend uses PLURAL  `/admin/users/...` for /reset-baseline,
 *     /settings, /snippets, /timeline (different cluster)
 * The Next.js route mirrors the backend's path segment so the
 * BFF→Flask hop is unambiguous.
 *
 * Response shape (full longitudinal admin view):
 *   { user: AdminUserContextUser, sessions: AdminUserContextSession[] }
 *
 * PUT body — every field optional, only included keys are written
 * (null clears):
 *   {
 *     private_admin_notes?:        string | null,
 *     queued_override_question?:   string | null,
 *     coach_override_profile?:     string | null,
 *   }
 *
 * `custom_llm_instructions` was dropped from the BE PATCH branch in
 * b004659 (Tab 3 "Global LLM Instructions" card deleted in FE
 * ed9ed70). Keep this BFF surface narrow so an accidental caller
 * doesn't try to send a field the BE silently drops.
 *
 * Returns the full updated payload on PUT — same shape as GET — so
 * callers can render from one round-trip without a follow-up fetch.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  const path = `/v2/admin/user/${userId}/context`;
  console.log(`[API /admin/user/${userId}/context] GET → ${path}`);
  return proxyJson<AdminUserContextPayload>(path, undefined, req);
}

type PutBody = {
  private_admin_notes?: string | null;
  queued_override_question?: string | null;
  coach_override_profile?: string | null;
};

export async function PUT(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  const path = `/v2/admin/user/${userId}/context`;
  const body = (await req.json()) as PutBody;
  console.log(
    `[API /admin/user/${userId}/context] PUT → ${path}`,
    Object.keys(body)
  );
  return proxyJson<PutBody, AdminUserContextPayload>(
    path,
    { method: "PUT", body },
    req
  );
}
