import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* POST /api/v2/research/golden/:surface/seal — seal the founder's golden set
 * once, at fifty (ML-7, L6). The backend's @require_founder is the gate and
 * refuses under fifty (GOLDEN_SET_INCOMPLETE) or a second seal (SEALED). */
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export const POST = proxyRoute("POST", "/v2/research/golden/:surface/seal", { relay: RELAY });
