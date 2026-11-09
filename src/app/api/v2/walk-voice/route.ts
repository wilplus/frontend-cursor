import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Will's voice in the walk (backend N565): the message for one step of the
 *  walk, written by the founder's rules, or null for the signed line. */
export const POST = proxyRoute("POST", "/v2/walk-voice", { body: "json" });
