import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The profile's "AI models" (backend N528 items 1 and 5): {section}, null
 *  when the person started and teaches none. 404 below ring 6. */
export const GET = proxyRoute("GET", "/v2/models/profile/:userId", { noStore: true });
