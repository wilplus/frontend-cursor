import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Your own profile (backend N366; ring 6): read it, or change your name,
 *  who you are or your About. */
export const GET = proxyRoute("GET", "/v2/profile", { noStore: true });
export const PATCH = proxyRoute("PATCH", "/v2/profile", { body: "json", noStore: true });
