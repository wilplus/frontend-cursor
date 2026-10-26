import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** The open times for one of the plan's calls (the kickoff before the
 *  deadline, the summary after it), from the booking page's own hours. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = new URLSearchParams();
  for (const key of ["which", "from", "to", "tz"]) {
    const value = req.nextUrl.searchParams.get(key);
    if (value) params.set(key, value);
  }
  const response = await callBackend(`/v2/plan/slots?${params.toString()}`, { method: "GET" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
