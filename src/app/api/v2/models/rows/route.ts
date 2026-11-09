import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The rows under the people in the list of chats (backend N528 item 1,
 *  N563 item 1): {rows}, "Your queue" for whoever teaches, then "AI models".
 *  404 below ring 6, read as no rows. */
export const GET = proxyRoute("GET", "/v2/models/rows", { noStore: true });
