import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** One part of the recipe kept: {value} -> {recipe, cost}, or 400 with its code. */
export const PUT = proxyRoute("PUT", "/v2/chats/setup/:part", { body: "json", noStore: true });
