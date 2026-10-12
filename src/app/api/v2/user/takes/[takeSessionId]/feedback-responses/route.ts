import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The owner's own answers on their Take (the answered bookmark, Q19 A). */
export const GET = proxyRoute("GET", "/v2/user/takes/:takeSessionId/feedback-responses", { guest: true });
