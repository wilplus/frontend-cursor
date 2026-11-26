import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
/** The clip's words and the app's better wording (backend N705). */
export const GET = proxyRoute("GET", "/v2/user/speaking-patterns/:source/:session/:snippet/rewrite", { noStore: true });
