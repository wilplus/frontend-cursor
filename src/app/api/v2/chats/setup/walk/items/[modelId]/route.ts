import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** One thing the walk notices, or its line (backend N647 items 2, 6):
 *  {on} or {says} -> the walk as GET reads it; the host's own models only. */
export const PUT = proxyRoute("PUT", "/v2/chats/setup/walk/items/:modelId", { body: "json", noStore: true });
