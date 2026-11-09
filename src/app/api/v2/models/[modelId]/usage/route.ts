import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The buyer's month with one model (backend N566 item 9, MOD-44). */
export const GET = proxyRoute("GET", "/v2/models/:modelId/usage", { noStore: true });
