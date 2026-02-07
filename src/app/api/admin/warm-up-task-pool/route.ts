import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ warm_up_task_pool: [] });
  }
  let res: Response;
  try {
    res = await fetch(`${backend}/v2/admin/warm-up-task-pool`, {
      headers: { Authorization: `Bearer ${token}` },
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
  // Backend may return 200 with warm_up_task_pool: [] when table is missing; always treat as array.
  const pool = Array.isArray(data.warm_up_task_pool) ? data.warm_up_task_pool : [];
  return NextResponse.json({ warm_up_task_pool: pool });
}

export async function POST(request: NextRequest) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ error: "Backend URL not set" }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));
  let res: Response;
  try {
    res = await fetch(`${backend}/v2/admin/warm-up-task-pool`, {
      method: "POST",
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
