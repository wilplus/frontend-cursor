import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A changed line, dated (backend N255 Q6). */
export const POST = proxyRoute("POST", "/v2/your-why/:line", { body: "json" });
