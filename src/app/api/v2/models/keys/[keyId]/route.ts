import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Delete this key" (backend MOD-44). */
export const DELETE = proxyRoute("DELETE", "/v2/models/keys/:keyId", { noStore: true });
