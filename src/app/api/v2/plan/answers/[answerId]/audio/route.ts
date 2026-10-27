import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayAudio } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** One of the speaker's own voice answers, played back (the key line's "How
 *  you said it", and their voice bubbles). */
export const GET = proxyRoute("GET", "/v2/plan/answers/:answerId/audio", { relay: relayAudio });
