import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** The closing summary after a Take's review (founder lock 2026-10-12, §3). */
export const POST = proxyRoute("POST", "/v2/explore/arc/:arcId/review/summary", { body: "json" });
