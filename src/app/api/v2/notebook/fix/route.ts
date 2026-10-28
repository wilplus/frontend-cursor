import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A voice note's words fixed by the person (backend N194). */
export const POST = proxyRoute("POST", "/v2/notebook/fix", { body: "json" });
