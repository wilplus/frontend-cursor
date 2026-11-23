import "server-only";
import type { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export async function GET(req: NextRequest, { params }: { params: { snippetId: string } }) {
  const take = req.nextUrl.searchParams.get("take_session_id") ?? "";
  const response = await callBackend(
    `/v2/user/lounge/moment/${encodeURIComponent(params.snippetId)}?take_session_id=${encodeURIComponent(take)}`,
    { method: "GET" },
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
