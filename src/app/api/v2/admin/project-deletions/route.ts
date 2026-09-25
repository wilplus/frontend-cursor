import "server-only";
import { NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** Operator queue of open project deletion requests (P1, N8). The backend's
 * admin decorator is the authorization boundary; this BFF only forwards. */
export async function GET(): Promise<NextResponse> {
  const response = await callBackend("/v2/admin/project-deletions", {
    method: "GET",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
