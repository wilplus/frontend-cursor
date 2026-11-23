import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** GET /v2/chats/<id>/reply-examples. The query (limit, offset) is forwarded. */
export async function GET(req: NextRequest, context: { params: { chatId: string } }) {
  const chatId = encodeURIComponent(context.params.chatId);
  const response = await callBackend(`/v2/chats/${chatId}/reply-examples${req.nextUrl.search}`, { method: "GET" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
