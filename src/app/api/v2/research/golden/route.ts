import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* GET /api/v2/research/golden — the golden sets' counts (ML-7). Forwards the
 * JWT; the backend's @require_research_read is the gate. */
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export const GET = proxyRoute("GET", "/v2/research/golden", { relay: RELAY, noStore: true });
