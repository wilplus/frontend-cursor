import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** The tempo step's stretch for one Take (backend N162, N166). */
export const GET = proxyRoute("GET", "/v2/explore/arc/:arcId/review/tempo/:takeId", { noStore: true });
