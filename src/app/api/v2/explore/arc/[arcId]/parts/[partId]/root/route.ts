import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  { params }: { params: { arcId: string; partId: string } }
) {
  const arc = encodeURIComponent(params.arcId);
  const part = encodeURIComponent(params.partId);
  return callBackend(`/v2/explore/arc/${arc}/parts/${part}/root`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: (await req.text()) || "{}",
  });
}
