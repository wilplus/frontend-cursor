import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Life goals: the goal as the lens holds it, kept after every answer. */
export const PUT = proxyRoute("PUT", "/v2/life-goals/drafts", { body: "json" });
