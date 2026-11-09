import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Switch to version {v}": the buyer chooses when (backend N566 item 9). */
export const POST = proxyRoute("POST", "/v2/models/keys/:keyId/switch", { body: "json", noStore: true });
