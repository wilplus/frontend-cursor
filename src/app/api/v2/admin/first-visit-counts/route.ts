import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* The founder's first-visit path, the last 30 days (backend N271): every
 * step from the landing page to the walk, the sign-up screen included. */
export const GET = proxyRoute("GET", "/v2/admin/first-visit-counts?days=30", { noStore: true });
