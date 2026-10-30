import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The walk showed the Take's quote (backend N268). */
export const POST = proxyRoute("POST", "/v2/walk-quote/shown", { body: "json" });
