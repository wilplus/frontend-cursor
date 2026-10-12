import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* POST /api/v2/research/golden/:surface/judgements — one founder judgement
 * (ML-7, L6). Body passed through; the backend's @require_founder is the gate. */
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export const POST = proxyRoute("POST", "/v2/research/golden/:surface/judgements", { body: "json", relay: RELAY });
