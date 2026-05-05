import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { UserAdminContext } from "@/lib/api/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  const path = `/admin/user/${userId}/context`;
  console.log(`[API /admin/user/${userId}/context] Fetching admin context`);
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
  const path = `/admin/user/${userId}/context`;
  const body = (await req.json()) as PatchBody;
  console.log(`[API /admin/user/${userId}/context] PATCH`, Object.keys(body));
  return proxyJson<PatchBody, UserAdminContext>(path, { method: "PATCH", body }, req);
}
