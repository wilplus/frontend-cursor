import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export const maxDuration = 60;

/* POST /api/v2/admin/learning/weekly/run — run the weekly job now (founder
 * only, ML-3). Forwards the JWT; the backend's @require_founder is the gate. */
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export const POST = proxyRoute("POST", "/v2/admin/learning/weekly/run", { relay: RELAY, noStore: true });
