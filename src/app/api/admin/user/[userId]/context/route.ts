import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { UserAdminContext } from "@/lib/api/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  // Backend convention is /v2/admin/users/<id>/context — note the
  // /v2/ prefix and the plural "users". Our Next.js route here keeps
  // the legacy singular path (/api/admin/user/<id>/context) so frontend
  // callers don't have to change; only the proxy target moves.
  const path = `/v2/admin/users/${userId}/context`;
  console.log(`[API /admin/user/${userId}/context] GET → ${path}`);
  return proxyJson<UserAdminContext>(path, undefined, req);
}

type PatchBody = {
  user_email?: string | null;
  /** Free-form admin notes about the user. */
  general_notes?: string | null;
  /** Persistent rules forwarded to the LLM on the user's next session. */
  custom_instructions?: string | null;
  /** Optional max word target the admin wants enforced. */
  max_words?: number | null;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  // /v2/ prefix + plural "users" per backend convention.
  const path = `/v2/admin/users/${userId}/context`;
  const body = (await req.json()) as PatchBody;
  console.log(`[API /admin/user/${userId}/context] PATCH → ${path}`, Object.keys(body));
  return proxyJson<PatchBody, UserAdminContext>(path, { method: "PATCH", body }, req);
}
