import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** MLC-3 §3.5: the speaker's app confirms an exercise card actually rendered.
 *  Body `{exercise_id}`; the backend records it once per offer. */
export const POST = proxyRoute("POST", "/v2/user/snippets/:snippetId/exercise-rendered", { body: "json" });
