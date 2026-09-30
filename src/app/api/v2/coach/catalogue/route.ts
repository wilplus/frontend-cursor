import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

// The catalogue of signed lines (founder 2026-09-30, E3, C4; contract 35f):
// praise lines and rewrite moves, one signed sentence per pattern, versioned.
// A plain pass-through; the backend signs the line with the caller.
export async function GET(_req: NextRequest) {
  return callBackend("/v2/coach/catalogue", { method: "GET" });
}

export async function POST(req: NextRequest) {
  return callBackend("/v2/coach/catalogue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: (await req.text()) || "{}",
  });
}
