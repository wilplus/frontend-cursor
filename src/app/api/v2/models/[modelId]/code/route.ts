import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The code in JavaScript, Python and curl (backend N566 items 8 and 9, MOD-43). */
export const GET = proxyRoute("GET", "/v2/models/:modelId/code", { noStore: true });
