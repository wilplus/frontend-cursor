import { NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** The published coach. Absent on the backend: the screens keep today's walk. */
export async function GET() {
  const response = await callBackend("/v2/coaches/speaking-coach/active", { method: "GET" });
  if (response.status === 404) {
    return NextResponse.json({ document: null }, { headers: { "Cache-Control": "no-store" } });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
