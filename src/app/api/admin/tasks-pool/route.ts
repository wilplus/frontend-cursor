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
    return NextResponse.json({ tasks_pool: [] });
  }
  let res: Response;
  try {
    res = await fetch(`${backend}/v2/admin/tasks-pool`, {
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
  const rawList = Array.isArray(data.tasks_pool)
    ? data.tasks_pool
    : Array.isArray(data.task_warm_up_pool)
      ? data.task_warm_up_pool
      : [];
  return NextResponse.json({ tasks_pool: rawList });
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
    res = await fetch(`${backend}/v2/admin/tasks-pool`, {
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
