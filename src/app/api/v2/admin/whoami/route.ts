import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  GET /api/v2/admin/whoami — 200 {admin:true} or the backend's 403.          */
/*                                                                            */
/*  The probe every admin page renders behind. Carries no secret: it forwards  */
/*  only the caller's JWT, and @require_admin upstream is the gate. Passing    */
/*  the 403 through verbatim is the point — the page needs to distinguish      */
/*  "not an admin" from "the backend is unreachable", and only the status      */
/*  carries that.                                                             */
/* -------------------------------------------------------------------------- */
export const GET = proxyRoute("GET", "/v2/admin/whoami", { noStore: true });
