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
    let sessions: unknown[] = [];
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const res = await fetch(`${backend}/v2/homework/sessions`, {
      method: "GET",
      headers,
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      sessions = Array.isArray(data.sessions) ? data.sessions : [];
    }
    if (sessions.length === 0) {
      const meRes = await fetch(`${backend}/v2/homework/me`, { method: "GET", headers });
      if (meRes.ok) {
        const meData = (await meRes.json().catch(() => ({}))) as { sessions?: unknown[]; profile?: { sessions?: unknown[] } };
        const fromMe = Array.isArray(meData.sessions) ? meData.sessions : (Array.isArray(meData.profile?.sessions) ? meData.profile.sessions : []);
        if (fromMe.length > 0) sessions = fromMe;
      }
    }
    if (sessions.length === 0 && !res.ok && res.status !== 404 && res.status !== 501) {
      const errBody = await res.json().catch(() => ({}));
      return NextResponse.json(errBody as object, { status: res.status });
    }
    return NextResponse.json({ sessions }, { status: 200 });
  } catch {
    return NextResponse.json({ sessions: [] }, { status: 200 });
  }
}
