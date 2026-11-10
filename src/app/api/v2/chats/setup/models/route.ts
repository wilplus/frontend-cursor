import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The models other people shared, each with its owner's price: {models}. */
export const GET = proxyRoute("GET", "/v2/chats/setup/models", { noStore: true });
