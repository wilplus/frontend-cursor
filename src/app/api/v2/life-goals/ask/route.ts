import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Life goals: Start or Not now under the ask after a note (N172 M1). */
export const POST = proxyRoute("POST", "/v2/life-goals/ask", { body: "json" });
