import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Accept, Edit or Not now in the lens (backend N241 N2). */
export const POST = proxyRoute("POST", "/v2/strengths/:strengthId/decide", { body: "json" });
