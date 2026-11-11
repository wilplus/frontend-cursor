import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "I want this" for a kind of set not ready yet (backend N645 item 3, as
 *  N641 item 3): one mail to the founder, not counted -> {wanted}. */
export const POST = proxyRoute("POST", "/v2/models/coming/:kind/want", { body: "json", noStore: true });
