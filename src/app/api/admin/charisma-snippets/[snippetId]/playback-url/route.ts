import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ snippetId: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backend = getBackendUrl();
  const { snippetId } = await params;
  const res = await fetch(`${backend}/v2/admin/charisma-snippets/${snippetId}/playback-url`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
