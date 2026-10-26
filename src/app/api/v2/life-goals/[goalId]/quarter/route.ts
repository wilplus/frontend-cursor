import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Life goals: how the quarter went, in words, and the next step (N186). */
export const POST = proxyRoute("POST", "/v2/life-goals/:goalId/quarter", { body: "json" });
