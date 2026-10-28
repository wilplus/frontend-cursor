import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Life goals: Not now or Start under "Did it move?" (N186). */
export const POST = proxyRoute("POST", "/v2/life-goals/:goalId/quarter/ask", { body: "json" });
