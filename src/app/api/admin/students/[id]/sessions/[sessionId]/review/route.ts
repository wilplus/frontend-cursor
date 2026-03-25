import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

/**
 * ML review labels for a session — proxied to Flask (same pattern as recordings/[id]/review).
 * Avoids Supabase service role on the Next.js host; invalid/missing SUPABASE_SERVICE_ROLE_KEY
 * on Vercel previously surfaced as { error: "Invalid API key" } from direct PostgREST calls.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: userId, sessionId } = await params;
  const backend = getBackendUrl();
  const res = await fetch(
    `${backend}/v2/admin/students/${userId}/sessions/${sessionId}/review`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: userId, sessionId } = await params;
  const body = await request.json().catch(() => ({}));
  const backend = getBackendUrl();
  const res = await fetch(
    `${backend}/v2/admin/students/${userId}/sessions/${sessionId}/review`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
