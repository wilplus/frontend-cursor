import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

export async function GET(request: NextRequest) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ tasks: [] });
  }
  const res = await fetch(`${backend}/v2/admin/tasks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) {
      return NextResponse.json({ tasks: [] });
    }
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}

function stubTask(body: { title?: string }): { id: string; title: string; prompt_text: null } {
  const id = crypto.randomUUID();
  const title =
    typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "New task";
  return { id, title, prompt_text: null };
}

export async function POST(request: NextRequest) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ task: stubTask(body) });
  }
  const res = await fetch(`${backend}/v2/admin/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) {
      return NextResponse.json({ task: stubTask(body) });
    }
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
