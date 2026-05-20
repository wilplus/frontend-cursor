import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";
import {
  useMockHomework,
  requireAuth,
  mockStartResponse,
} from "@/lib/api/homework-mock";
import { openingTaskTextFromApiPayload } from "@/lib/api/homework-utils";

export const runtime = "nodejs";
export const maxDuration = 30;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (useMockHomework()) {
    const unauth = await requireAuth(req);
    if (unauth) return unauth;
    return NextResponse.json(mockStartResponse());
  }

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
  const res = await fetch(`${backend}/v2/homework/session/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 404) {
    return NextResponse.json(mockStartResponse());
  }
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  const opening = openingTaskTextFromApiPayload(data);
  const fromBackendTask = typeof data.task === "string" ? data.task.trim() : "";
  const fromBackendTaskText = typeof data.task_text === "string" ? data.task_text.trim() : "";
  const resolved = opening || fromBackendTask || fromBackendTaskText || "";
  const normalized = {
    ...data,
    task: resolved || null,
    task_text: resolved,
  };
  return NextResponse.json(normalized, { status: res.status });
}
