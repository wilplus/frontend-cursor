import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* GET /api/v2/research/golden/:surface/next — the next moment for the founder
 * to judge (ML-7, L6). The backend's @require_founder is the gate; the moment
 * carries a passage and a signed clip, no label and no machine read. */
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export const GET = proxyRoute("GET", "/v2/research/golden/:surface/next", { relay: RELAY, noStore: true });
