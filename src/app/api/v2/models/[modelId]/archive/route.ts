import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The owner's Archive: hidden from every list, nothing deleted (N528 item 5, MOD-50). */
export const POST = proxyRoute("POST", "/v2/models/:modelId/archive", { body: "json", noStore: true });
