import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The two demo chats, seeded for the caller (ring 6, feature `chats`);
 *  answers as GET /v2/chats does. */
export const POST = proxyRoute("POST", "/v2/chats/demo", { body: "json" });
