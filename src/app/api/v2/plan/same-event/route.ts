import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The plan (docs/flows/the-plan.md H2): `POST /v2/plan/same-event`. */
export const POST = proxyRoute("POST", "/v2/plan/same-event", { body: "json", noStore: true });
