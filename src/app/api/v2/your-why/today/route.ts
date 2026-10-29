import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The Lounge opened: the ask, or the day's why (backend N255 Q3, Q4). */
export const POST = proxyRoute("POST", "/v2/your-why/today", { body: "json" });
