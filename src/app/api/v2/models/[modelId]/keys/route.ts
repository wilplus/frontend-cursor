import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A key, in the answer once (backend N566 item 9, MOD-42): never cached,
 *  never logged here. */
export const POST = proxyRoute("POST", "/v2/models/:modelId/keys", { body: "json", noStore: true });
