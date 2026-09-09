import "server-only";
import { NextRequest, NextResponse } from "next/server";
import {
  backendFetch,
  callBackend,
  getAccessToken,
} from "@/app/api/_lib/backend";

export const runtime = "nodejs";

const UUID = "[0-9a-fA-F-]{36}";
const ALLOWED = [
  new RegExp(`^reviews/${UUID}$`),
  new RegExp(`^reviews/playback/${UUID}$`),
  new RegExp(`^reviews/assignments/${UUID}/render$`),
  new RegExp(`^reviews/assignments/${UUID}/judgments$`),
  new RegExp(`^reviews/${UUID}/complete$`),
] as const;

function target(parts: string[]): string | null {
  const joined = parts.map((part) => encodeURIComponent(part)).join("/");
  return ALLOWED.some((pattern) => pattern.test(joined))
    ? `/v2/coach/mlc3/${joined}`
    : null;
}

async function forward(
  request: NextRequest,
  method: "GET" | "POST",
  parts: string[],
): Promise<NextResponse> {
  const path = target(parts);
  if (!path) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const idempotency = request.headers.get("Idempotency-Key")?.trim();
  if (method === "POST" && !idempotency) {
    return NextResponse.json(
      { code: "INVALID_INPUT", error: "Idempotency-Key is required." },
      { status: 400 },
    );
  }
  if (method === "GET" && /^\/v2\/coach\/mlc3\/reviews\/playback\//.test(path)) {
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Authentication required." },
        { status: 401 },
      );
    }
    const upstream = await backendFetch(path, { method: "GET", token });
    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("Content-Type") ?? "audio/wav");
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("X-Content-Type-Options", "nosniff");
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  }
  return callBackend(path, {
    method,
    headers: method === "POST"
      ? { "Content-Type": "application/json", "Idempotency-Key": idempotency! }
      : undefined,
    body: method === "POST" ? ((await request.text()) || "{}") : undefined,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: { path: string[] } },
) {
  return forward(request, "GET", context.params.path);
}

export async function POST(
  request: NextRequest,
  context: { params: { path: string[] } },
) {
  return forward(request, "POST", context.params.path);
}
