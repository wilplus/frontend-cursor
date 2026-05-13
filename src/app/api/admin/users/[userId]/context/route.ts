import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { AdminUserContextPayload } from "@/lib/api/admin-client";

/**
 * BFF: /api/admin/users/[userId]/context  (GET + PATCH)
 *
 * Proxies to backend GET/PATCH /v2/admin/users/<userId>/context.
 *
 * Note: the singular /api/admin/user/[userId]/context BFF (different
 * route) also exists and forwards to /v2/admin/user/<id>/context for
 * legacy callers that haven't migrated. The backend accepts both
 * paths and all of GET/PUT/PATCH on either — this route only wires
 * the new plural surface using PATCH for the mutator.
 *
 * GET response shape: AdminUserContextPayload
 *   { user: AdminUserContextUser, sessions: AdminUserContextSession[] }
 *
 * PATCH body — every key optional, partial update:
 *   { custom_llm_instructions?:    string | null,
 *     private_admin_notes?:        string | null,
 *     queued_override_question?:   string | null,
 *     coach_override_profile?:     string | null }
 * PATCH returns the same shape as GET (post-write) so the admin
 * view can replace its local context state from the response.
 *
 * The `x-bff-revision: phase-12` header is forwarded on every
 * outbound request so backend logs can attribute a regression to
 * a specific BFF version when one rolls out.
 */

const BFF_HEADERS: Record<string, string> = {
  "x-bff-revision": "phase-12",
};

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  const path = `/v2/admin/users/${userId}/context`;
  console.log(`[API /admin/users/${userId}/context] GET → ${path}`);
  return proxyJson<AdminUserContextPayload>(
    path,
    { headers: BFF_HEADERS },
    req
  );
}

type PatchBody = {
  custom_llm_instructions?: string | null;
  private_admin_notes?: string | null;
  queued_override_question?: string | null;
  coach_override_profile?: string | null;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  const path = `/v2/admin/users/${userId}/context`;
  const body = (await req.json().catch(() => ({}))) as PatchBody;
  console.log(
    `[API /admin/users/${userId}/context] PATCH → ${path}`,
    Object.keys(body)
  );
  return proxyJson<PatchBody, AdminUserContextPayload>(
    path,
    { method: "PATCH", headers: BFF_HEADERS, body },
    req
  );
}
