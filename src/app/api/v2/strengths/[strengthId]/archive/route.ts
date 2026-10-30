import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Only the person archives a strength (backend N241 N5). */
export const POST = proxyRoute("POST", "/v2/strengths/:strengthId/archive", { body: "json" });
