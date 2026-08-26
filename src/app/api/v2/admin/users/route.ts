import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** Admin user directory. The backend remains the authorization boundary;
 * this BFF only forwards the caller's JWT and an allowlisted query shape. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const source = req.nextUrl.searchParams;
  const forwarded = new URLSearchParams();
  for (const key of ["search", "limit", "offset"]) {
    const value = source.get(key);
    if (value) forwarded.set(key, value);
  }
  const query = forwarded.toString();
  const response = await callBackend(
    `/v2/admin/users${query ? `?${query}` : ""}`,
    { method: "GET" }
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
