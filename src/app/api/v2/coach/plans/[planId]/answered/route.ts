import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The coach's side of the plan (backend N213): `POST /v2/coach/plans/:planId/answered`. */
export const POST = proxyRoute("POST", "/v2/coach/plans/:planId/answered", { body: "json", noStore: true });
