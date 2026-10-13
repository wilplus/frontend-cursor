import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* The Data & consent card for the AI version of your voice (founder lock
   2026-10-12, N71): GET reads on or off, POST turns it on, DELETE deletes it
   at the provider and here and turns it off. */
export const GET = proxyRoute("GET", "/v2/user/ai-voice", { noStore: true });
export const POST = proxyRoute("POST", "/v2/user/ai-voice", { body: "json", noStore: true });
export const DELETE = proxyRoute("DELETE", "/v2/user/ai-voice", { noStore: true });
