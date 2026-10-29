import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A tap on one of the sale's four steps (backend N241 P2). */
export const POST = proxyRoute("POST", "/v2/notebook/sales-step", { body: "json" });
