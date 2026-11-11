import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The feedback walk, part by part (backend N647 items 1, 2, 6):
 *  {steps, out, runs_on_messages, notice, say}. A static folder takes this
 *  path from `[part]`, so the part's own PUT is served here too. */
export const GET = proxyRoute("GET", "/v2/chats/setup/walk", { noStore: true });
export const PUT = proxyRoute("PUT", "/v2/chats/setup/walk", { body: "json", noStore: true });
