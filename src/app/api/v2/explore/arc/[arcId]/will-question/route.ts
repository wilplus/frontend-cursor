import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Will's one question after a Take: the speaker's tap (founder 2026-10-20, N82). */
export const POST = proxyRoute("POST", "/v2/explore/arc/:arcId/will-question", { body: "json" });
