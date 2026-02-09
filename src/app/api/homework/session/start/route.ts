import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";
import {
  useMockHomework,
  requireAuth,
  mockStartResponse,
} from "@/lib/api/homework-mock";

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
  // Normalize: backend may send warm_up_task { id, text } or warm_up_task_text string
  const warmUpTask = data.warm_up_task as { id?: string; text?: string } | undefined;
  const warmUpTaskTextFromObj =
    warmUpTask && typeof warmUpTask === "object" && typeof warmUpTask.text === "string"
      ? warmUpTask.text
      : undefined;
  const normalized = {
    ...data,
    warm_up_task: data.warm_up_task ?? null,
    warm_up_task_text:
      (data.warm_up_task_text as string) ??
      warmUpTaskTextFromObj ??
      (data.task_text as string) ??
      "",
  };
  return NextResponse.json(normalized, { status: res.status });
}
