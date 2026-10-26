import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Life goals: which wins when two goals clash, kept on both ladders (N185 M12). */
export const POST = proxyRoute("POST", "/v2/life-goals/:goalId/clash", { body: "json" });
