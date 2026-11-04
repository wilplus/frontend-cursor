import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The chats' reports, for the founder's CEO panel (backend N466). Under the
 *  CEO panel's own BFF path, so the CEO host serves it and the main host
 *  does not (`src/lib/ceo/hostRouting.ts`), as with its bugs and tasks. */
export const GET = proxyRoute("GET", "/v2/admin/chat-reports", { noStore: true });
