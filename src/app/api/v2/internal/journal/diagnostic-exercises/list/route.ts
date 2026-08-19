import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return callBackend("/v2/internal/journal/diagnostic-exercises/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: (await req.text()) || "{}",
    requireAuth: false,
  });
}
