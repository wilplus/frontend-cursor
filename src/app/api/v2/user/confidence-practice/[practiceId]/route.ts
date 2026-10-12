import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

export const GET = proxyRoute("GET", "/v2/user/confidence-practice/:practiceId");
