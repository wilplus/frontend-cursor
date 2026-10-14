import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* What the pricing screen shows for me: my plan promotion and my lesson card. */
export const GET = proxyRoute("GET", "/v2/user/offers", { noStore: true });
