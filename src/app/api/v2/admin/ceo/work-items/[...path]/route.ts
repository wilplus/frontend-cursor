import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

const ALLOWED = [
  /^bugs$/,
  /^bugs\/[A-Za-z0-9-]{1,80}$/,
  /^bugs\/[A-Za-z0-9-]{1,80}\/retry$/,
  /^tasks$/,
  /^tasks\/[A-Za-z0-9-]{1,80}$/,
  /^tasks\/[A-Za-z0-9-]{1,80}\/(?:reorder|done|archive|restore)$/,
];
const QUERY_KEYS = ["project", "view", "feature_id", "confirmed"];

function target(
  request: NextRequest,
  context: { params: { path: string[] } }
): string | null {
  const path = context.params.path.join("/");
  if (!ALLOWED.some((pattern) => pattern.test(path))) return null;
  const query = new URLSearchParams();
  for (const key of QUERY_KEYS) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) query.set(key, value);
  }
  const suffix = query.toString();
  return `/v2/admin/ceo/${path}${suffix ? `?${suffix}` : ""}`;
}

async function proxy(
  request: NextRequest,
  context: { params: { path: string[] } }
): Promise<NextResponse> {
  const destination = target(request, context);
  if (!destination) {
    return NextResponse.json(
      { code: "NOT_FOUND", error: "Not found." },
      { status: 404 }
    );
  }
  const method = request.method;
  const hasBody = method === "POST" || method === "PATCH";
  const response = await callBackend(destination, {
    method,
    ...(hasBody
      ? {
          headers: { "Content-Type": "application/json" },
          body: await request.text(),
        }
      : {}),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
