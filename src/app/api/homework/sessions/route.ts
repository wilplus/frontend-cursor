import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

export const dynamic = "force-dynamic";

/** List current user's completed homework sessions (for "View reports" modal). Backend may not implement; 404 returns []. */
export async function GET(req: NextRequest) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ sessions: [] }, { status: 200 });
  }
  try {
    const res = await fetch(`${backend}/v2/homework/sessions`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (res.status === 404 || res.status === 501) {
      return NextResponse.json({ sessions: [] }, { status: 200 });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    return NextResponse.json({ sessions }, { status: 200 });
  } catch {
    return NextResponse.json({ sessions: [] }, { status: 200 });
  }
}
