import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl, getCurrentUserId } from "@/app/api/getAuth";

export const dynamic = "force-dynamic";

/**
 * List current user's completed sessions — same source as admin panel.
 * Backend must allow GET /v2/admin/students/:id when id === token's user id (in addition to admin-for-any-user).
 */
export async function GET(req: NextRequest) {
  const token = await getV2AccessToken(req);
  const userId = await getCurrentUserId(req);
  if (!token || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ sessions: [] }, { status: 200 });
  }
  try {
    const res = await fetch(`${backend}/v2/admin/students/${userId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return NextResponse.json(errBody as object, { status: res.status });
    }
    const data = (await res.json().catch(() => ({}))) as { sessions?: unknown[] };
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    return NextResponse.json({ sessions }, { status: 200 });
  } catch {
    return NextResponse.json({ sessions: [] }, { status: 200 });
  }
}
