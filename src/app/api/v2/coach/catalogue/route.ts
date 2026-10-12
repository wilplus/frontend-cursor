import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

// The catalogue of signed lines (founder 2026-09-30, E3, C4; contract 35f):
// praise lines and rewrite moves, one signed sentence per pattern, versioned.
// A plain pass-through; the backend signs the line with the caller.
export const GET = proxyRoute("GET", "/v2/coach/catalogue");

export const POST = proxyRoute("POST", "/v2/coach/catalogue", { body: "json" });
