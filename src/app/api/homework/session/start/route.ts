import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";
import {
  useMockHomework,
  requireAuth,
  mockStartResponse,
} from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (useMockHomework()) {
    const unauth = await requireAuth(req);
    if (unauth) return unauth;
    return NextResponse.json(mockStartResponse());
  }

  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { error: "Backend URL not configured" },
      { status: 503 }
    );
  }
  const res = await fetch(`${backend}/v2/homework/session/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data, { status: res.status });
}
