import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The coach's side of the plan (backend N213; docs/flows/the-plan.md): the
 *  plan to answer, blind. The backend enforces the coach role and the
 *  queue's language gate, and never sends the plan's level before the pick. */
export const GET = proxyRoute("GET", "/v2/coach/plans/:planId", { noStore: true });
