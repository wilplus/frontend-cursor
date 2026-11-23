import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

const preview = () => NextResponse.json({ preview: true }, { headers: { "Cache-Control": "no-store" } });

/** A visitor's message, answered from the host's setup. The backend patch
 *  is not deployed yet, so a missing route becomes a quiet preview. */
export async function POST(request: NextRequest, context: { params: { chatId: string } }) {
  const chatId = context.params.chatId;
  const body = await request.text();
  try {
    const response = await callBackend(`/v2/chats/${encodeURIComponent(chatId)}/reply`, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") || "application/json" },
      body: body || "{}",
    });
    if (!response.ok) return preview();
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return preview();
  }
}
