import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The people the speaker can send a Take to, the one sent to last first (backend N470, N472). */
export const GET = proxyRoute("GET", "/v2/user/takes/send/people", { noStore: true });
