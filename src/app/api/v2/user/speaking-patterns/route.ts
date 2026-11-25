import type { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = new URLSearchParams();
  for (const key of ["offset", "kind", "source", "q"]) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) params.set(key, value);
  }
  const response = await callBackend("/v2/user/speaking-patterns" + (params.size ? "?" + params : ""), { method: "GET" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
