import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Life goals: Will's draft from the speaker's own answers (N172 M5). */
export const POST = proxyRoute("POST", "/v2/life-goals/draft", { body: "json" });
