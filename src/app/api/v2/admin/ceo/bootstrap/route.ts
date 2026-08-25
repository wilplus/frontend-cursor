import "server-only";
import { NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const response = await callBackend("/v2/admin/ceo/bootstrap", {
    method: "GET",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
