import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams;
  const query = new URLSearchParams({
    arc: from.get("arc") ?? "",
    session: from.get("session") ?? "",
    snippet: from.get("snippet") ?? "",
  });
  return callBackend(`/v2/moment-history?${query.toString()}`, {
    method: "GET",
  });
}
