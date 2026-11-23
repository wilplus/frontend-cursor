import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const GET = proxyRoute("GET", "/v2/explore/arc/:arcId/review/notes/:takeId", { noStore: true });
export const PUT = proxyRoute("PUT", "/v2/explore/arc/:arcId/review/notes/:takeId", { body: "json" });
