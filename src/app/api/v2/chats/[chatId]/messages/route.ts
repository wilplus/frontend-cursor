import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** One chat's messages, oldest first (ring 6, feature `chats`). */
export const GET = proxyRoute("GET", "/v2/chats/:chatId/messages", { noStore: true });

/** A message sent in the chat: in this slice an emoji, 👍 👀 or 🙏 (N306, N311). */
export const POST = proxyRoute("POST", "/v2/chats/:chatId/messages", { body: "json" });
