import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Phase 2 of the after-practice paths (founder 2026-10-01, F1; migration
 *  0408): the speaker's app reports that a bookmark opened or was skipped.
 *  Body `{event, shown}`; the backend records it once per event. */
export const POST = proxyRoute("POST", "/v2/user/snippets/:snippetId/moment-event", { body: "json" });
