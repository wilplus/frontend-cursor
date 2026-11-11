import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** One chart's counts by week, as a file (backend N648 item 5). */
export const GET = proxyRoute("GET", "/v2/chats/setup/dev/charts/:name.csv", { noStore: true });
