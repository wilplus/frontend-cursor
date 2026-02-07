import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ error: "Backend URL not set" }, { status: 503 });
  }
  const { poolId } = await params;
  const body = await request.json().catch(() => ({}));
  let res: Response;
  try {
    res = await fetch(`${backend}/v2/admin/focus-task-pool/${poolId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Backend unreachable";
    return NextResponse.json({ error: "Backend unreachable", message: msg }, { status: 502 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ error: "Backend URL not set" }, { status: 503 });
  }
  const { poolId } = await params;
  let res: Response;
  try {
    res = await fetch(`${backend}/v2/admin/focus-task-pool/${poolId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Backend unreachable";
    return NextResponse.json({ error: "Backend unreachable", message: msg }, { status: 502 });
  }
  if (res.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
