import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getCurrentUserIdentity, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const backend = getBackendUrl();
  const currentUser = await getCurrentUserIdentity(request);
  let body: Record<string, unknown> | null = null;
  try {
    const parsed = await request.json().catch(() => null);
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    // no body
  }
  const requestBody: Record<string, unknown> = { ...(body ?? {}) };
  if (currentUser.displayName) {
    requestBody.coach_name = currentUser.displayName;
  }
  if (currentUser.initials) {
    requestBody.coach_initials = currentUser.initials;
  }
  const res = await fetch(`${backend}/v2/admin/students/${id}/send-assignment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
