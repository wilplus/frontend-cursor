import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Models other people shared (GET, {models}) and the host's own cards kept
 *  (PUT). A static folder takes this path from `[part]`, so Teach it and a
 *  price kept or dropped never reach `[part]`'s PUT. The backend serves that
 *  save on PUT /v2/chats/setup/<part> with part `models`. */
export const GET = proxyRoute("GET", "/v2/chats/setup/models", { noStore: true });
export const PUT = proxyRoute("PUT", "/v2/chats/setup/models", { body: "json", noStore: true });
