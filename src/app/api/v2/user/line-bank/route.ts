import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v2/user/line-bank
 *
 * Which line each signed bank says next for the caller (build plan D-FW-3;
 * backend 0438, routes/v2/line_bank.py): 200 {"next": {bank: index}}.
 * Indexes into the signed banks only. Verbatim pass-through.
 */
export const GET = proxyRoute("GET", "/v2/user/line-bank");
