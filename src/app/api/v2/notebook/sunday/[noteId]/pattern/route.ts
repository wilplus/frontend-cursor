import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The Sunday note: Old or New for the week's bug (Will learning plan, step 2). */
export const POST = proxyRoute("POST", "/v2/notebook/sunday/:noteId/pattern", { body: "json" });
