import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
/** The clip's words, for Sniper's pause places (backend N705). */
export const GET = proxyRoute("GET", "/v2/user/speaking-patterns/:source/:session/:snippet/words", { noStore: true });
