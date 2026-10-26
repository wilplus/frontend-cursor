import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Life goals: the goal is set; its ladder goes to the Lounge (N172 M10). */
export const POST = proxyRoute("POST", "/v2/life-goals/:goalId/finish", { body: "json" });
