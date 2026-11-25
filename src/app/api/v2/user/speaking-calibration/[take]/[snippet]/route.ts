import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const GET = proxyRoute("GET", "/v2/user/speaking-calibration/:take/:snippet", { noStore: true });
export const PUT = proxyRoute("PUT", "/v2/user/speaking-calibration/:take/:snippet", { body: "json", noStore: true });
