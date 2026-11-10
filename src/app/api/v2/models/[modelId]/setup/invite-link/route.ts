import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Copy an invite link" (backend N563 item 6): {link}. */
export const GET = proxyRoute("GET", "/v2/models/:modelId/setup/invite-link", { noStore: true });
