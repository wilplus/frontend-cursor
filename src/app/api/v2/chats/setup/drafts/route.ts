import { NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** The answers the host still has to send. A missing route stays quiet. */
export async function GET() {
  try {
    const response = await callBackend("/v2/chats/setup/drafts", { method: "GET" });
    if (!response.ok) {
      return NextResponse.json({ drafts: null }, { headers: { "Cache-Control": "no-store" } });
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ drafts: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
