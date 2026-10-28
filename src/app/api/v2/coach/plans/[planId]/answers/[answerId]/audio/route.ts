import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayAudio } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** The speaker's voice message or key line, played to the coach (backend
 *  N213); no other answer of the plan. */
export const GET = proxyRoute("GET", "/v2/coach/plans/:planId/answers/:answerId/audio", { relay: relayAudio });
