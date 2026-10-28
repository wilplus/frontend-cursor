import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The plan (docs/flows/the-plan.md): `POST /v2/plan/ask-coach`. */
export const POST = proxyRoute("POST", "/v2/plan/ask-coach", { body: "json", noStore: true });
