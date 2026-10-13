import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* The oldest ask the admin sent this person that they haven't answered yet. */
export const GET = proxyRoute("GET", "/v2/user/asks/next", { noStore: true });
