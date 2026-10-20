import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The Take's ask closed in the Lounge: the message after the Take, held
 *  back until then, is let go under it (founder 2026-10-20, one action at a
 *  time; backend services/after_take.py). 200 {message | null}. */
export const POST = proxyRoute("POST", "/v2/user/lounge/after-take", { body: "json", noStore: true });
