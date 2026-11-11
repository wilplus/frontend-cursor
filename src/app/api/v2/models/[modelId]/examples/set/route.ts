import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A set of written cases for a model (backend N645 item 4):
 *  {texts, may_use} -> {added, skipped}; at most 200 in one call. */
export const POST = proxyRoute("POST", "/v2/models/:modelId/examples/set", { body: "json", noStore: true });
