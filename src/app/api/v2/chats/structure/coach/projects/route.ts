import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const GET = proxyRoute("GET", "/v2/chats/structure/coach/projects", { noStore: true });
