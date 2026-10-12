import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Relay a confidence-practice attempt check. The walk sees only next and key. */
export const POST = proxyRoute("POST", "/v2/user/confidence-practice/:practiceId/attempts/:attemptId/check", { body: "json" });
