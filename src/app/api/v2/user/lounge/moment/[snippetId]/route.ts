import "server-only";
import type { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export async function GET(req: NextRequest, { params }: { params: { snippetId: string } }) {
  const search = req.nextUrl.searchParams;
  const take = search.get("take_session_id") ?? "";
  const intervention = search.get("intervention") === "ai_audio" ? "&intervention=ai_audio" : "";
  const response = await callBackend(
    `/v2/user/lounge/moment/${encodeURIComponent(params.snippetId)}?take_session_id=${encodeURIComponent(take)}${intervention}`,
    { method: "GET" },
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
