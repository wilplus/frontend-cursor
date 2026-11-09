import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Matching by how you speak, the person's own switch (backend N463 item 2,
 *  N465, N559 item 6, #1861): GET {on, available}; POST {on}, and off
 *  deletes what Will learned from how they speak. */
export const GET = proxyRoute("GET", "/v2/me/speaking-match", { noStore: true });
export const POST = proxyRoute("POST", "/v2/me/speaking-match");
