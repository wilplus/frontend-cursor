import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** The tempo step's stretch for one Take (backend N162, N166). */
export const GET = proxyRoute("GET", "/v2/explore/arc/:arcId/review/tempo/:takeId", { noStore: true });

/** The tempo game as played, kept for Will (backend N166 step 4). */
export const POST = proxyRoute("POST", "/v2/explore/arc/:arcId/review/tempo/:takeId", { body: "json" });
