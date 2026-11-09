import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Make public", after its disclaimer: {confirm: true} (N528 item 5, MOD-50). */
export const POST = proxyRoute("POST", "/v2/models/:modelId/make-public", { body: "json", noStore: true });
