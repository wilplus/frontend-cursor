import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

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
  let body: Record<string, unknown> | null = null;
  try {
    const parsed = await request.json().catch(() => null);
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    // no body
  }
  const res = await fetch(`${backend}/v2/admin/students/${id}/send-assignment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
