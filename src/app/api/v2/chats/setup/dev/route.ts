import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Developer mode's numbers (backend N648; ring chat_builder, 404 without it):
 *  {close, notice, says, charts, data}. For the host only. */
export const GET = proxyRoute("GET", "/v2/chats/setup/dev", { noStore: true });
