import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = proxyRoute("GET", "/v2/user/product-discoveries");
