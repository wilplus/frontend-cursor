import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Not now | Start under "One more thing: your why." (backend N255 Q3). */
export const POST = proxyRoute("POST", "/v2/your-why/ask", { body: "json" });
