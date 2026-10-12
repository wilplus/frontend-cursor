import "server-only";
import { notFound } from "next/navigation";
import { NextRequest } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  POST /api/v2/internal/journal/<tool> — the Journal CMS's internal tools.   */
/*                                                                            */
/*  Fifteen route.ts files were identical apart from the backend path (audit  */
/*  2026-09-16, folded into one 2026-10-12). Only the tools below are         */
/*  forwarded; any other path is a 404, as it was with no file there. The     */
/*  slow tools keep their own files for their own time limits: community/     */
/*  generate, image/generate, and revalidate (a static route wins over this). */
/*                                                                            */
/*  Password-gated on the BACKEND: the admin password rides in the request     */
/*  body, so this route adds no auth of its own and requires no Supabase      */
/*  session. It relays the upstream status + body verbatim so the CMS can     */
/*  show 401 (wrong password) and 503 (password not configured) distinctly.   */
/*  The password is never logged.                                             */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";

const TOOLS = new Set([
  "posts/list", "posts/get", "posts/create", "posts/update", "posts/delete",
  "posts/publish", "posts/unpublish", "reorder", "media/presign",
  "community/list", "community/update", "community/delete",
  "image/list", "image/select", "image/delete",
]);

const FAILURES: Failures = {
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Journal service unavailable." } },
};
const RELAY = relayLenient({ bareStatuses: [204, 205, 304] });

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const tool = params.path.join("/");
  if (!TOOLS.has(tool)) notFound();
  const body = await req.json().catch(() => ({}));
  return callBackend(`/v2/internal/journal/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    token: null,
    requireAuth: false,
    failures: FAILURES,
    relay: RELAY,
  });
}
