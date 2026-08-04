import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/user/library?tag=
 *
 * BFF proxy for the strong-sides library (§7 / §3.11). @require_auth.
 *   200 → { entries: [ { id, session_id, snippet_id, note, tag, snippet_ref,
 *                        created_at } ], count }
 * The coach's curated, tagged snippets — read-only replay of human-authored
 * notes (never trajectory/profiling). Optional ?tag=strong|to_work_on filter.
 */
export async function GET(req: NextRequest) {
  // Forwarded explicitly — nothing is passed through wholesale.
  const tag = req.nextUrl.searchParams.get("tag");
  const qs = tag ? `?tag=${encodeURIComponent(tag)}` : "";
  return callBackend(`/v2/user/library${qs}`, { method: "GET" });
}
