import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The walk quotes your notebook (backend N268): the Take's one quote for
 *  the sentence it practises, or null. */
export const POST = proxyRoute("POST", "/v2/walk-quote", { body: "json" });
