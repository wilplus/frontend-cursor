import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Life goals: a tapped step changed, the earlier words kept (N172 M11). */
export const POST = proxyRoute("POST", "/v2/life-goals/:goalId/steps", { body: "json" });
