import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Start with this, finish the rest later" (backend N566 item 2). */
export const POST = proxyRoute("POST", "/v2/models/:modelId/setup/start-now", { body: "json", noStore: true });
