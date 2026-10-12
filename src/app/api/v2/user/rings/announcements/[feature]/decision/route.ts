import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  POST /api/v2/user/rings/announcements/[feature]/decision                   */
/*  The person's answer to an announcement: {decision: "accepted"|"not_now"}. */
/*  It records an answer and NOTHING else — no consent is created here (L3);  */
/*  the consent screens record consent and the feature turns on only when the */
/*  backend sees it.                                                          */
/* -------------------------------------------------------------------------- */
// Auth is demanded by callBackend's default; the failure envelopes are the
// helper's own defaults, so no new user-facing string is minted here (copy is
// founder-held).
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export const POST = proxyRoute("POST", "/v2/user/rings/announcements/:feature/decision", { body: "json", relay: RELAY, noStore: true });
