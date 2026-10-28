import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Will's ask for the plan's own yes (docs/flows/the-plan.md D): `POST
 *  /v2/plan/consent/answer`, "Yes, ask me" or "Not now". */
export const POST = proxyRoute("POST", "/v2/plan/consent/answer", { body: "json", noStore: true });
