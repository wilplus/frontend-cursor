import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Did this feedback help you?": the speaker's tap (WIL-74, founder 2026-10-19). */
export const POST = proxyRoute("POST", "/v2/explore/arc/:arcId/feedback-check", { body: "json" });
