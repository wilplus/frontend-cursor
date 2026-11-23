import { NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** The founder's speaking-coach draft. The backend route is not there yet,
 *  so a 404 becomes an empty draft and the browser stays quiet. */
export async function GET() {
  const response = await callBackend("/v2/coaches/speaking-coach", { method: "GET" });
  if (response.status === 404) {
    return NextResponse.json({ document: null }, { headers: { "Cache-Control": "no-store" } });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
