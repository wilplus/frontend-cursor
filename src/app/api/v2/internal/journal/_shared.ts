import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  internalJournalPassthrough — the shared shape behind the Journal CMS's     */
/*  internal tools (audit: 15 route.ts files were byte-identical apart from    */
/*  the backend path and their own doc comment; post-audit cleanup, 2026-09-16)*/
/*                                                                            */
/*  Password-gated on the BACKEND: the admin password rides in the request      */
/*  body, exactly like every other internal tool, so this factory adds no       */
/*  auth of its own and requires no Supabase session. It relays the upstream    */
/*  status + body verbatim so the CMS can show 401 (wrong password) and 503     */
/*  (password not configured) distinctly. The password is never logged.        */
/* -------------------------------------------------------------------------- */

const FAILURES: Failures = {
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Journal service unavailable." } },
};
const RELAY = relayLenient({ bareStatuses: [204, 205, 304] });

/** Returns a POST handler that relays a JSON body to `backendPath` verbatim. */
export function internalJournalPassthrough(backendPath: string) {
  return async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    return callBackend(backendPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      token: null,
      requireAuth: false,
      failures: FAILURES,
      relay: RELAY,
    });
  };
}
