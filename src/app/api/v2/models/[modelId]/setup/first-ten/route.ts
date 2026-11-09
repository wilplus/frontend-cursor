import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The next of the owner's first 10, on the teachers' screen (backend N570 item 3). */
export const GET = proxyRoute("GET", "/v2/models/:modelId/setup/first-ten", { noStore: true });
