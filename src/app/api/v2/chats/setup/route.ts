import { NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

const empty = () => NextResponse.json(
  { recipe: null, parts: [], own_chat: null, cost: null, can_try: false, skipped_models: [], price_changes: [], spec_guess: null },
  { headers: { "Cache-Control": "no-store" } },
);

/** A host's setup. The recipe is people_profiles.chat_recipe (v2). A missing
 *  route stays an empty read, so the tiles still open. */
export async function GET() {
  try {
    const response = await callBackend("/v2/chats/setup", { method: "GET" });
    if (!response.ok) return empty();
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return empty();
  }
}
