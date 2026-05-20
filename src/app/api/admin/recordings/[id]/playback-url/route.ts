import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

/**
 * GET signed playback URL for a recording (admin). Use for report modal when report API doesn't return audio_url.
 * Backend: GET /v2/admin/recordings/:id/playback-url (or same as student with admin auth).
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const backend = getBackendUrl();
  const res = await fetch(`${backend}/v2/admin/recordings/${id}/playback-url`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
