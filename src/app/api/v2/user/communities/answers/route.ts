import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** One answer on another speaker's moment: {clip_id, value}. */
export const POST = proxyRoute("POST", "/v2/user/communities/answers", { body: "json" });
