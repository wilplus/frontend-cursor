import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  GET /api/v2/admin/learning/ledger — the founder's pace panel (ML-4).       */
/*                                                                            */
/*  CARRIES NO SECRET: forwards the caller's JWT; the backend's                */
/*  @require_founder is the gate and a non-founder gets its 403 through.      */
/*  AC-9: counts about the machine, for the founder alone; never proxied to   */
/*  a speaker's surface.                                                      */
/* -------------------------------------------------------------------------- */
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export const GET = proxyRoute("GET", "/v2/admin/learning/ledger", { relay: RELAY, noStore: true });
