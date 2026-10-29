import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Will's drafts, only from their words (backend N255 Q2). */
export const POST = proxyRoute("POST", "/v2/your-why/draft", { body: "json" });
