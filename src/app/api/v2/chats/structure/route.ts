import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const GET = proxyRoute("GET", "/v2/chats/structure", { noStore: true });
export const POST = proxyRoute("POST", "/v2/chats/structure", { body: "json" });
