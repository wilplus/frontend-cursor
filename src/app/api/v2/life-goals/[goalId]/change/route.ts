import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Life goals: Change or Not now under a note that sounds like a change (N172 M14, N187). */
export const POST = proxyRoute("POST", "/v2/life-goals/:goalId/change", { body: "json" });
