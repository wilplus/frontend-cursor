import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The speaker's last choice of who hears a Take, for the default (backend N470, N479). */
export const GET = proxyRoute("GET", "/v2/user/takes/send/last", { noStore: true });
