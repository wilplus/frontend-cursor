import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Join a community with a pass code. */
export const POST = proxyRoute("POST", "/v2/user/communities/join", { body: "json" });
