import "server-only";
import { NextRequest, NextResponse } from "next/server";
import {
  backendFetch,
  callBackend,
  getAccessToken,
} from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = "[0-9a-fA-F-]{36}";
const ALLOWED = [
  /^feedback\/(render|respond)$/,
  /^feedback\/speaker$/,
  /^exercise-offers$/,
  new RegExp(`^exercise-offers/${UUID}$`),
  new RegExp(`^exercise-offers/${UUID}/playback$`),
  new RegExp(`^exercise-offers/${UUID}/events$`),
  new RegExp(`^exercise-offers/${UUID}/practice-sessions$`),
  new RegExp(`^practice-sessions/${UUID}$`),
  new RegExp(`^practice-sessions/${UUID}/events$`),
  new RegExp(`^practice-sessions/${UUID}/attempts$`),
  new RegExp(`^practice-sessions/${UUID}/preference$`),
  new RegExp(`^practice-attempts/${UUID}/speaker$`),
  new RegExp(`^practice-attempts/${UUID}/playback$`),
  new RegExp(`^guidance/${UUID}$`),
  new RegExp(`^guidance/${UUID}/playback$`),
  new RegExp(`^guidance/${UUID}/events$`),
] as const;

function target(parts: string[]): string | null {
  const joined = parts.map((part) => encodeURIComponent(part)).join("/");
  return ALLOWED.some((pattern) => pattern.test(joined))
    ? `/v2/user/mlc3/${joined}`
    : null;
}

async function forward(
  req: NextRequest,
  method: "GET" | "POST",
  parts: string[],
): Promise<NextResponse> {
  const path = target(parts);
  if (!path) {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  }
  const isPlayback = method === "GET" && /\/playback$/.test(path);
  if (isPlayback) {
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Authentication required." },
        { status: 401 },
      );
    }
    const upstream = await backendFetch(path, { method: "GET", token });
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ??
          "application/octet-stream",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const idempotency = req.headers.get("Idempotency-Key")?.trim();
  if (!idempotency) {
    return NextResponse.json(
      { code: "INVALID_INPUT", error: "Idempotency-Key is required." },
      { status: 400 },
    );
  }
  const contentType = req.headers.get("Content-Type") ?? "";
  const headers = { "Idempotency-Key": idempotency };
  if (method === "GET") {
    return callBackend(path, { method, headers });
  }
  if (contentType.toLowerCase().startsWith("multipart/form-data")) {
    return callBackend(path, {
      method,
      headers,
      body: await req.formData(),
    });
  }
  return callBackend(path, {
    method,
    headers: { ...headers, "Content-Type": "application/json" },
    body: (await req.text()) || "{}",
  });
}

export async function GET(
  req: NextRequest,
  context: { params: { path: string[] } },
) {
  return forward(req, "GET", context.params.path);
}

export async function POST(
  req: NextRequest,
  context: { params: { path: string[] } },
) {
  return forward(req, "POST", context.params.path);
}
