import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Not now | Look under "We spotted a strength!" (backend N241 N2). */
export const POST = proxyRoute("POST", "/v2/strengths/:strengthId/ask", { body: "json" });
