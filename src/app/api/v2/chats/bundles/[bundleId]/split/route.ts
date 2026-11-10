import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Split them up" (backend N584 item 1, N602 item 2): {questions: [ids]},
 *  those questions into a bundle of their own; {bundle}. */
export const POST = proxyRoute("POST", "/v2/chats/bundles/:bundleId/split", { body: "json", noStore: true });
