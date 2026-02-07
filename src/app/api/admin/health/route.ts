import { NextResponse } from "next/server";

/**
 * GET /api/admin/health — no auth. Use to verify admin API routes are deployed.
 * In Network tab, check for header X-BFF-Route: admin-health.
 */
export async function GET() {
  const res = NextResponse.json({
    ok: true,
    _debug: "admin-health",
    message: "Admin BFF is reachable. If /api/admin/tasks returns 404, redeploy so tasks route is included.",
  });
  res.headers.set("X-BFF-Route", "admin-health");
  return res;
}
