import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The speaking way in while Take 1 is processed (docs/flows/the-plan.md §2;
 *  backend N572, N573, N592): `POST /v2/plan/way-in`, `{chat, known?,
 *  answer?, tz}`. Begins once Take 1 is sent, takes the answer to the open
 *  beat, and writes the beats that are due into the Lounge. */
export const POST = proxyRoute("POST", "/v2/plan/way-in", { body: "json", noStore: true });
