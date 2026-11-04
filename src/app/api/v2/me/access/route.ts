import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** By invitation (backend N471): {member, invite_only} for the signed-in
 *  caller. A waiting account's first ask sends the founder the one waitlist
 *  email. */
export const GET = proxyRoute("GET", "/v2/me/access", { noStore: true });
