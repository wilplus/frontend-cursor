import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Life goals: their own notes that say what got in the way too (N186). */
export const POST = proxyRoute("POST", "/v2/life-goals/:goalId/quarter/notes", { body: "json" });
