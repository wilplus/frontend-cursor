import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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
  const res = await fetch(`${backend}/v2/homework/session/status`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data, { status: res.status });
}
