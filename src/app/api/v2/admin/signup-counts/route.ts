import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* The founder's sign-up count, the last 30 days (backend N207 item 6). */
export const GET = proxyRoute("GET", "/v2/admin/signup-counts?days=30", { noStore: true });
