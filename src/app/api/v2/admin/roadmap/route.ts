import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  GET /api/v2/admin/roadmap — the founder's roadmap (founder 2026-10-21).    */
/*                                                                            */
/*  CARRIES NO SECRET: forwards the caller's JWT; the backend's                */
/*  @require_founder is the gate and a non-founder gets its 403 through.      */
/* -------------------------------------------------------------------------- */
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export const GET = proxyRoute("GET", "/v2/admin/roadmap", { relay: RELAY, noStore: true });
