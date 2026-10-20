import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Keep a voice notebook?": Yes or Not now. */
export const POST = proxyRoute("POST", "/v2/notebook/consent", { body: "json" });
