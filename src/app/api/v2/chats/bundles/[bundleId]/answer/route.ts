import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Record one answer" (backend N584 item 3): {take, duration_ms}, a Take of
 *  my own, sent to everyone in the bundle not yet sent it; {sent}. */
export const POST = proxyRoute("POST", "/v2/chats/bundles/:bundleId/answer", { body: "json", noStore: true });
