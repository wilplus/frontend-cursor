import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  GET /api/v2/research/overview — the research screen's one read (ML-7).    */
/*                                                                            */
/*  CARRIES NO SECRET: forwards the caller's JWT; the backend's                */
/*  @require_research_read (the research role or an admin, GET only) is the   */
/*  gate. Pseudonyms only upstream; no row names a person.                    */
/* -------------------------------------------------------------------------- */
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export const GET = proxyRoute("GET", "/v2/research/overview", { relay: RELAY, noStore: true });
