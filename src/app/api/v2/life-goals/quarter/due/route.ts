import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Life goals: the quarter comes back when the Lounge opens (N172 M13, N186). */
export const POST = proxyRoute("POST", "/v2/life-goals/quarter/due", { body: "json" });
