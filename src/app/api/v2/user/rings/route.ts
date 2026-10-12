import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  /api/v2/user/rings — what is on for the signed-in person and which        */
/*  announcements are pending for them (the backend rings migration). Read at login by the   */
/*  announcement sheet and by the hooks that decide whether a ringed overlay   */
/*  lane mounts. Carries the person's own ring and feature list, never a      */
/*  score or anyone else's row. @require_auth backend-side.                    */
/* -------------------------------------------------------------------------- */
// Auth is demanded by callBackend's default; the failure envelopes are the
// helper's own defaults, so no new user-facing string is minted here (copy is
// founder-held).
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export const GET = proxyRoute("GET", "/v2/user/rings", { relay: RELAY, noStore: true });
