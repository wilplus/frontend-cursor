import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  /api/v2/admin/rings/* — the founder's rollout panel (the backend rings migration).        */
/*                                                                            */
/*  CARRIES NO SECRET: it forwards only the caller's JWT and the backend's     */
/*  @require_admin is the gate; a non-admin gets the 403 passed through.       */
/*  Query keys are allowlisted where a query exists. Every write goes to one   */
/*  SECURITY DEFINER RPC upstream; nothing here decides a ring, a kill or a    */
/*  consent (rings decide reach, never provenance).                            */
/* -------------------------------------------------------------------------- */
// Auth is demanded by callBackend's default; the failure envelopes are the
// helper's own defaults, so no new user-facing string is minted here (copy is
// founder-held).
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export const POST = proxyRoute("POST", "/v2/admin/rings/people/bulk", { body: "json", relay: RELAY, noStore: true });
