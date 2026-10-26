import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Life goals: does the new goal pull against a kept one (N185 M12). */
export const POST = proxyRoute("POST", "/v2/life-goals/:goalId/clash/check", { body: "json" });
