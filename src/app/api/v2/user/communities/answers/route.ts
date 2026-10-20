import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** One answer on another speaker's moment: {clip_id, value}. */
export const POST = proxyRoute("POST", "/v2/user/communities/answers", { body: "json" });

/** The listener's latest answers with their clips, newest first: the
 *  judging reopened from the Lounge. */
export const GET = proxyRoute("GET", "/v2/user/communities/answers", { noStore: true });
