import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** List the caller's communities. */
export const GET = proxyRoute("GET", "/v2/user/communities");

/** Open a community. */
export const POST = proxyRoute("POST", "/v2/user/communities", { body: "json" });
