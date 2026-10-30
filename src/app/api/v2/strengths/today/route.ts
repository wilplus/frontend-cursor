import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The Lounge opened: a strength the day before a talk (backend N241 N4). */
export const POST = proxyRoute("POST", "/v2/strengths/today", { body: "json" });
