import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Life goals: the goal under a want (N172 M6). */
export const POST = proxyRoute("POST", "/v2/life-goals/redraft", { body: "json" });
