import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A walk played again: the quote it already showed (backend N268). */
export const POST = proxyRoute("POST", "/v2/walk-quote/replay", { body: "json" });
